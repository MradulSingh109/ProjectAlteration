import { describe, it, expect, vi, beforeEach } from "vitest";
import { RuleEvaluationService } from "@/application/alerts/rule-evaluation.service";
import { IAlertRepository } from "@/domain/alerts/alert.repository.interface";
import { IAlertRuleRepository } from "@/domain/alerts/rule.repository.interface";
import { ITelemetryRepository } from "@/domain/telemetry/telemetry.repository.interface";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { IAuditLogRepository } from "@/domain/audit/audit-log.repository.interface";
import { IRuleEvaluator } from "@/domain/alerts/rule-evaluator.interface";
import {
  AlertEntity,
  AlertRuleVersionEntity,
} from "@/domain/alerts/alert.entity";
import { CanonicalTelemetryReading } from "@/domain/telemetry/telemetry.entity";
import { WellEntity } from "@/domain/wells/well.entity";
import { AppError } from "@/lib/errors";

describe("Rule Evaluation Application Service", () => {
  let mockAlertRepo: IAlertRepository;
  let mockRuleRepo: IAlertRuleRepository;
  let mockTelemetryRepo: ITelemetryRepository;
  let mockWellRepo: IWellRepository;
  let mockAuditRepo: IAuditLogRepository;
  let mockEvaluator: IRuleEvaluator;
  let service: RuleEvaluationService;

  const sampleWell: WellEntity = {
    id: "well-100",
    wellId: "W-100",
    name: "Alpha-100",
    field: "Mumbai Offshore",
    latitude: 19.3,
    longitude: 71.4,
    plannedDepthMd: 3500,
    plannedDepthTvd: 3200,
    status: "DRILLING",
    spudDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleReading: CanonicalTelemetryReading = {
    id: "reading-100",
    wellId: "well-100",
    sourceId: "RIG-01",
    sequenceNumber: 10,
    timestamp: new Date("2026-09-28T12:00:00Z"),
    measurements: {
      depthMd: 2500,
      depthTvd: 2480,
      standpipePressure: 4800, // Spike above 4500
    },
    ingestedAt: new Date(),
    createdAt: new Date(),
  };

  const sampleRuleVersion: AlertRuleVersionEntity = {
    id: "ver-p1",
    ruleId: "rule-p1",
    version: 1,
    isActive: true,
    severity: "HIGH",
    conditions: {
      type: "THRESHOLD",
      metric: "standpipePressure",
      operator: ">",
      threshold: 4500,
      unit: "psi",
    },
    createdAt: new Date(),
    rule: {
      id: "rule-p1",
      ruleCode: "PRESSURE_SPIKE_DETECT",
      name: "Pressure Spike",
      description: "Detects spike",
      eventType: "PRESSURE_SPIKE",
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const sampleAlert: AlertEntity = {
    id: "alert-100",
    wellId: "well-100",
    ruleVersionId: "ver-p1",
    telemetryReadingId: "reading-100",
    alertType: "PRESSURE_SPIKE",
    severity: "HIGH",
    status: "ACTIVE",
    triggeredAt: new Date("2026-09-28T12:00:00Z"),
    explanation: "Rule PRESSURE_SPIKE_DETECT triggered",
    evidence: {
      metric: "standpipePressure",
      observedValue: 4800,
      threshold: 4500,
      unit: "psi",
      measurementTimestamp: "2026-09-28T12:00:00Z",
      readingSequenceNumber: 10,
      depthMd: 2500,
      conditionDescription: "standpipePressure > 4500 psi",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockAlertRepo = {
      create: vi.fn().mockResolvedValue(sampleAlert),
      findById: vi.fn().mockResolvedValue(sampleAlert),
      findByReadingAndRuleVersion: vi.fn().mockResolvedValue(null),
      listByWellId: vi.fn().mockResolvedValue({
        items: [sampleAlert],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }),
      updateStatus: vi.fn().mockResolvedValue(sampleAlert),
    };

    mockRuleRepo = {
      listActiveRuleVersions: vi.fn().mockResolvedValue([sampleRuleVersion]),
      findRuleByCode: vi.fn(),
      findVersionById: vi.fn().mockResolvedValue(sampleRuleVersion),
      createRule: vi.fn(),
      createRuleVersion: vi.fn(),
    };

    mockTelemetryRepo = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(sampleReading),
      findByWellSourceSequence: vi.fn(),
      listByWellId: vi.fn().mockResolvedValue({
        wellId: "well-100",
        items: [sampleReading],
        pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
        timeRange: {},
      }),
    };

    mockWellRepo = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(sampleWell),
      findByWellId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      findNearby: vi.fn(),
    };

    mockAuditRepo = {
      create: vi.fn().mockResolvedValue({
        id: "audit-1",
        action: "ALERT_GENERATE",
        resourceType: "ALERT",
        resourceId: "alert-100",
        createdAt: new Date(),
      }),
      list: vi.fn(),
      findById: vi.fn(),
    };

    mockEvaluator = {
      evaluate: vi.fn().mockReturnValue({
        triggered: true,
        explanation: "Rule PRESSURE_SPIKE_DETECT triggered",
        evidence: sampleAlert.evidence,
      }),
    };

    service = new RuleEvaluationService(
      mockAlertRepo,
      mockRuleRepo,
      mockTelemetryRepo,
      mockWellRepo,
      mockAuditRepo,
      mockEvaluator,
    );
  });

  describe("Single Reading Evaluation", () => {
    it("successfully evaluates a reading and persists triggered alert", async () => {
      const result = await service.evaluateReading(
        "reading-100",
        "user-eng-1",
        "DRILLING_ENGINEER",
      );

      expect(result.readingId).toBe("reading-100");
      expect(result.alertsTriggeredCount).toBe(1);
      expect(result.alerts[0].id).toBe("alert-100");
      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          wellId: "well-100",
          ruleVersionId: "ver-p1",
          telemetryReadingId: "reading-100",
        }),
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_GENERATE",
          resourceType: "ALERT",
          resourceId: "alert-100",
        }),
      );
    });

    it("rejects evaluation if telemetry reading does not exist", async () => {
      vi.mocked(mockTelemetryRepo.findById).mockResolvedValue(null);

      await expect(service.evaluateReading("non-existent")).rejects.toThrow(
        AppError,
      );
      await expect(service.evaluateReading("non-existent")).rejects.toThrow(
        "Telemetry reading not found",
      );
      expect(mockAlertRepo.create).not.toHaveBeenCalled();
    });

    it("handles idempotency: returns existing alert without duplicate creation", async () => {
      vi.mocked(mockAlertRepo.findByReadingAndRuleVersion).mockResolvedValue(
        sampleAlert,
      );

      const result = await service.evaluateReading("reading-100");

      expect(result.alertsTriggeredCount).toBe(1);
      expect(result.alerts[0].id).toBe("alert-100");
      expect(mockAlertRepo.create).not.toHaveBeenCalled();
      expect(mockAuditRepo.create).not.toHaveBeenCalled();
    });

    it("does not create alert when condition is not triggered", async () => {
      vi.mocked(mockEvaluator.evaluate).mockReturnValue({ triggered: false });

      const result = await service.evaluateReading("reading-100");

      expect(result.alertsTriggeredCount).toBe(0);
      expect(mockAlertRepo.create).not.toHaveBeenCalled();
    });

    it("evaluates sustained mud flow discrepancy using chronological history window and records MUD_FLOW_DISCREPANCY", async () => {
      const mudRuleVersion: AlertRuleVersionEntity = {
        id: "ver-mud-1",
        ruleId: "rule-mud-1",
        version: 1,
        isActive: true,
        severity: "CRITICAL",
        conditions: {
          type: "DELTA",
          metricA: "flowRateIn",
          metricB: "flowRateOut",
          operator: ">",
          threshold: 50,
          unit: "gpm",
          consecutiveReadings: 3,
        },
        rule: {
          id: "rule-mud-1",
          ruleCode: "MUD_FLOW_DISCREPANCY_DETECT",
          name: "Mud Flow In vs Out Discrepancy",
          description: "Detects sustained mud flow deficit",
          eventType: "MUD_LOSS",
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        createdAt: new Date(),
      };

      vi.mocked(mockRuleRepo.listActiveRuleVersions).mockResolvedValue([
        mudRuleVersion,
      ]);
      vi.mocked(mockEvaluator.evaluate).mockReturnValue({
        triggered: true,
        explanation:
          "Sustained mud flow discrepancy detected across 3 consecutive readings",
        evidence: {
          metric: "flowRateIn - flowRateOut",
          observedValue: {
            flowRateIn: 500,
            flowRateOut: 410,
            calculatedDiscrepancy: 90,
            consecutiveReadingsObserved: 3,
          },
          threshold: {
            thresholdDelta: 50,
            consecutiveReadingsRequired: 3,
          },
          unit: "gpm",
          measurementTimestamp: "2026-09-28T12:00:20Z",
          readingSequenceNumber: 3,
          depthMd: 2500,
          conditionDescription:
            "Sustained (flowRateIn - flowRateOut) > 50 gpm for 3 consecutive readings",
        },
      });

      const result = await service.evaluateReading(
        "reading-100",
        "user-eng-1",
        "DRILLING_ENGINEER",
      );

      expect(mockTelemetryRepo.listByWellId).toHaveBeenCalledWith(
        "well-100",
        expect.objectContaining({
          to: sampleReading.timestamp,
          pageSize: 6,
          sortOrder: "desc",
        }),
      );
      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: "MUD_FLOW_DISCREPANCY",
          severity: "CRITICAL",
        }),
      );
      expect(result.alertsTriggeredCount).toBe(1);
    });
  });

  describe("Range Evaluation & Validation Hardening", () => {
    const baseFrom = new Date("2026-09-28T00:00:00Z");
    const baseTo = new Date("2026-09-28T04:00:00Z"); // 4 hours

    it("evaluates readings in a valid bounded time range for a well", async () => {
      const result = await service.evaluateWellRange(
        "well-100",
        { from: baseFrom, to: baseTo, limit: 20 },
        "user-eng-1",
        "DRILLING_ENGINEER",
      );

      expect(result.wellId).toBe("well-100");
      expect(result.readingsEvaluatedCount).toBe(1);
      expect(result.alertsTriggeredCount).toBe(1);
      expect(mockTelemetryRepo.listByWellId).toHaveBeenCalledWith(
        "well-100",
        expect.objectContaining({
          from: baseFrom,
          to: baseTo,
          pageSize: 20,
        }),
      );
    });

    it("rejects range evaluation when from > to", async () => {
      const invalidFrom = new Date("2026-09-28T12:00:00Z");
      const invalidTo = new Date("2026-09-28T10:00:00Z");

      await expect(
        service.evaluateWellRange("well-100", {
          from: invalidFrom,
          to: invalidTo,
        }),
      ).rejects.toThrow("from date must be earlier than or equal to to date");
    });

    it("accepts evaluation range at exact maximum allowed duration (24 hours)", async () => {
      const exact24hTo = new Date(baseFrom.getTime() + 24 * 60 * 60 * 1000);

      const result = await service.evaluateWellRange("well-100", {
        from: baseFrom,
        to: exact24hTo,
        limit: 50,
      });

      expect(result.readingsEvaluatedCount).toBe(1);
    });

    it("rejects evaluation range when duration exceeds 24-hour maximum", async () => {
      const excessiveTo = new Date(
        baseFrom.getTime() + 24 * 60 * 60 * 1000 + 1000,
      ); // 24h + 1s

      await expect(
        service.evaluateWellRange("well-100", {
          from: baseFrom,
          to: excessiveTo,
        }),
      ).rejects.toThrow("exceeds maximum allowed limit of 24 hours");
    });

    it("accepts evaluation when limit <= 100", async () => {
      const result = await service.evaluateWellRange("well-100", {
        from: baseFrom,
        to: baseTo,
        limit: 100,
      });

      expect(result.readingsEvaluatedCount).toBe(1);
      expect(mockTelemetryRepo.listByWellId).toHaveBeenCalledWith(
        "well-100",
        expect.objectContaining({
          pageSize: 100,
        }),
      );
    });

    it("rejects evaluation when limit exceeds 100 readings", async () => {
      await expect(
        service.evaluateWellRange("well-100", {
          from: baseFrom,
          to: baseTo,
          limit: 101,
        }),
      ).rejects.toThrow("limit cannot exceed 100 readings per evaluation");
    });

    it("handles empty range result gracefully with zero alerts and zero readings evaluated", async () => {
      vi.mocked(mockTelemetryRepo.listByWellId).mockResolvedValueOnce({
        wellId: "well-100",
        items: [],
        pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
        timeRange: {},
      });

      const result = await service.evaluateWellRange("well-100", {
        from: baseFrom,
        to: baseTo,
      });

      expect(result.readingsEvaluatedCount).toBe(0);
      expect(result.alertsTriggeredCount).toBe(0);
      expect(result.alerts).toHaveLength(0);
      expect(mockAlertRepo.create).not.toHaveBeenCalled();
    });

    it("rejects range evaluation if well does not exist", async () => {
      vi.mocked(mockWellRepo.findById).mockResolvedValue(null);

      await expect(
        service.evaluateWellRange("unknown-well", {
          from: baseFrom,
          to: baseTo,
        }),
      ).rejects.toThrow("Well not found");
    });

    it("demonstrates idempotent repeated range evaluation without duplicate alerts", async () => {
      // First evaluation triggers creation
      const first = await service.evaluateWellRange("well-100", {
        from: baseFrom,
        to: baseTo,
      });
      expect(first.alertsTriggeredCount).toBe(1);
      expect(mockAlertRepo.create).toHaveBeenCalledTimes(1);

      // Second evaluation returns existing alert via findByReadingAndRuleVersion
      vi.mocked(
        mockAlertRepo.findByReadingAndRuleVersion,
      ).mockResolvedValueOnce(sampleAlert);
      const second = await service.evaluateWellRange("well-100", {
        from: baseFrom,
        to: baseTo,
      });

      expect(second.alertsTriggeredCount).toBe(1);
      expect(mockAlertRepo.create).toHaveBeenCalledTimes(1); // not called again
    });
  });
});
