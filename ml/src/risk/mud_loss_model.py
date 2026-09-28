"""Random Forest Mud Loss Risk Prediction Model for NWIS (Step 12)."""

from __future__ import annotations

from pathlib import Path
from typing import Any
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .schemas import RiskPredictionRequest, RiskPredictionResult


class MudLossRiskModel:
    """Random Forest classifier for predicting drilling mud loss hazard probabilities."""

    MODEL_VERSION = "rf-mud-loss-v1"

    NUMERIC_FEATURES = [
        "depth_md",
        "rop_mhr",
        "wob_klbs",
        "rpm",
        "torque_kftlb",
        "spp_psi",
        "flow_rate_gpm",
        "mud_weight_ppg",
        "ecd_ppg",
        "offset_wells_count_in_radius",
        "max_offset_similarity",
        "offset_mud_loss_count",
        "offset_stuck_pipe_count",
        "offset_kick_count",
        "offset_torque_spike_count",
        "nearest_hazard_distance_km",
        "offset_hazard_density",
    ]

    CATEGORICAL_FEATURES = ["formation", "lithology"]

    def __init__(
        self,
        n_estimators: int = 150,
        max_depth: int = 8,
        min_samples_split: int = 4,
        random_state: int = 42,
    ) -> None:
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.random_state = random_state

        self.preprocessor = ColumnTransformer(
            transformers=[
                ("num", StandardScaler(), self.NUMERIC_FEATURES),
                (
                    "cat",
                    OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                    self.CATEGORICAL_FEATURES,
                ),
            ],
            remainder="drop",
        )

        self.classifier = RandomForestClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            min_samples_split=self.min_samples_split,
            class_weight="balanced",
            random_state=self.random_state,
        )

        self.pipeline = Pipeline(
            steps=[
                ("preprocessor", self.preprocessor),
                ("classifier", self.classifier),
            ]
        )
        self.is_fitted = False
        self.feature_names_: list[str] = []

    def fit(self, train_df: pd.DataFrame, target_col: str = "is_mud_loss") -> MudLossRiskModel:
        """Fit the model on training split."""
        X_train = train_df[self.NUMERIC_FEATURES + self.CATEGORICAL_FEATURES]
        y_train = train_df[target_col].astype(int)

        self.pipeline.fit(X_train, y_train)
        self.is_fitted = True

        # Extract encoded feature names
        cat_encoder = self.pipeline.named_steps["preprocessor"].named_transformers_["cat"]
        cat_feature_names = cat_encoder.get_feature_names_out(self.CATEGORICAL_FEATURES).tolist()
        self.feature_names_ = self.NUMERIC_FEATURES + cat_feature_names

        return self

    def evaluate(self, test_df: pd.DataFrame, target_col: str = "is_mud_loss") -> dict[str, Any]:
        """Evaluate model performance on validation or test split."""
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before evaluation.")

        X = test_df[self.NUMERIC_FEATURES + self.CATEGORICAL_FEATURES]
        y_true = test_df[target_col].astype(int)

        y_proba = self.pipeline.predict_proba(X)[:, 1]
        y_pred = (y_proba >= 0.5).astype(int)

        # Handle ROC/PR when single class or imbalanced
        try:
            roc_auc = float(roc_auc_score(y_true, y_proba))
        except ValueError:
            roc_auc = 0.5

        try:
            pr_auc = float(average_precision_score(y_true, y_proba))
        except ValueError:
            pr_auc = 0.0

        metrics = {
            "total_samples": len(y_true),
            "positive_samples": int(y_true.sum()),
            "roc_auc": round(roc_auc, 4),
            "pr_auc": round(pr_auc, 4),
            "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        }
        return metrics

    def predict_one(self, req: RiskPredictionRequest | dict[str, Any]) -> RiskPredictionResult:
        """Predict mud loss risk for a single query."""
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted. Train or load weights first.")

        if isinstance(req, RiskPredictionRequest):
            d = {
                "well_id": req.well_id,
                "depth_md": req.depth_md,
                "formation": req.formation,
                "lithology": req.lithology,
                "rop_mhr": req.rop_mhr,
                "wob_klbs": req.wob_klbs,
                "rpm": req.rpm,
                "torque_kftlb": req.torque_kftlb,
                "spp_psi": req.spp_psi,
                "flow_rate_gpm": req.flow_rate_gpm,
                "mud_weight_ppg": req.mud_weight_ppg,
                "ecd_ppg": req.ecd_ppg,
                "offset_wells_count_in_radius": req.offset_wells_count_in_radius or 0,
                "max_offset_similarity": req.max_offset_similarity or 0.0,
                "offset_mud_loss_count": req.offset_mud_loss_count or 0,
                "offset_stuck_pipe_count": req.offset_stuck_pipe_count or 0,
                "offset_kick_count": req.offset_kick_count or 0,
                "offset_torque_spike_count": req.offset_torque_spike_count or 0,
                "nearest_hazard_distance_km": req.nearest_hazard_distance_km or 999.0,
                "offset_hazard_density": req.offset_hazard_density or 0.0,
            }
        else:
            d = req

        df = pd.DataFrame([d])
        X = df[self.NUMERIC_FEATURES + self.CATEGORICAL_FEATURES]

        proba = float(self.pipeline.predict_proba(X)[0, 1])

        # Map to risk level
        if proba >= 0.75:
            level = "CRITICAL"
            rec = "CRITICAL RISK: Pre-stage 25 bbl sized CaCO3/Mica LCM pill. Lower flow rate and closely monitor standpipe pressure."
        elif proba >= 0.50:
            level = "HIGH"
            rec = "HIGH RISK: Elevate monitoring of active pit volume and standpipe pressure. Restrict ECD across known weak zone."
        elif proba >= 0.25:
            level = "MEDIUM"
            rec = "MODERATE RISK: Review offset well LCM treatments. Maintain standby fine LCM."
        else:
            level = "LOW"
            rec = "LOW RISK: Standard drilling parameters within expected bounds."

        # Top feature importances
        clf = self.pipeline.named_steps["classifier"]
        importances = clf.feature_importances_
        feat_impacts = []
        for name, imp in sorted(zip(self.feature_names_, importances), key=lambda x: x[1], reverse=True)[:5]:
            feat_impacts.append({"feature": name, "importance": round(float(imp), 4)})

        return RiskPredictionResult(
            well_id=str(d.get("well_id", "UNKNOWN")),
            depth_md=float(d.get("depth_md", 0.0)),
            risk_type="MUD_LOSS",
            probability=round(proba, 4),
            level=level,
            model_version=self.MODEL_VERSION,
            top_contributing_features=feat_impacts,
            mitigation_recommendation=rec,
        )

    def predict_trajectory(self, df: pd.DataFrame) -> pd.DataFrame:
        """Predict risk probabilities and levels for an entire well trajectory."""
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted.")

        X = df[self.NUMERIC_FEATURES + self.CATEGORICAL_FEATURES]
        probas = self.pipeline.predict_proba(X)[:, 1]

        res_df = df.copy()
        res_df["mud_loss_probability"] = np.round(probas, 4)
        res_df["predicted_risk_level"] = [
            "CRITICAL" if p >= 0.75 else ("HIGH" if p >= 0.50 else ("MEDIUM" if p >= 0.25 else "LOW"))
            for p in probas
        ]
        return res_df

    def save(self, path: str | Path) -> None:
        """Save model pipeline bundle to disk."""
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "pipeline": self.pipeline,
                "feature_names": self.feature_names_,
                "model_version": self.MODEL_VERSION,
            },
            p,
        )

    @classmethod
    def load(cls, path: str | Path) -> MudLossRiskModel:
        """Load fitted model pipeline bundle from disk."""
        data = joblib.load(path)
        model = cls()
        model.pipeline = data["pipeline"]
        model.feature_names_ = data["feature_names"]
        model.is_fitted = True
        return model
