import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertLifecycleService } from "@/application/alerts/alert-lifecycle.service";
import { IAlertRepository } from "@/domain/alerts/alert.repository.interface";
import { IWellRepository } from "@/domain/wells/well.repository.interface";
import { IAuditLogRepository } from "@/domain/audit/audit-log.repository.interface";
import { AlertEntity, AlertStatus } from "@/domain/alerts/alert.entity";
import { WellEntity } from "@/domain/wells/well.entity";
import { AppError } from "@/lib/errors";

describe("Alert Lifecycle State Machine & Queries", () => {
  let mockAlertRepo: IAlertRepository;
  let mockWellRepo: IWellRepository;
  let mockAuditRepo: IAuditLogRepository;
  let service: AlertLifecycleService;

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

  const sampleActiveAlert: AlertEntity = {
    id: "alert-100",
    wellId: "well-100",
    ruleVersionId: "ver-p1",
    telemetryReadingId: "reading-100",
    alertType: "PRESSURE_SPIKE",
    severity: "HIGH",
    status: AlertStatus.ACTIVE,
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
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(sampleActiveAlert),
      findByReadingAndRuleVersion: vi.fn(),
      listByWellId: vi.fn().mockResolvedValue({
        items: [sampleActiveAlert],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }),
      updateStatus: vi.fn().mockImplementation((id, data) =>
        Promise.resolve({
          ...sampleActiveAlert,
          ...data,
          updatedAt: new Date(),
        }),
      ),
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
        action: "ALERT_ACKNOWLEDGE",
        resourceType: "ALERT",
        resourceId: "alert-100",
        createdAt: new Date(),
      }),
      list: vi.fn(),
      findById: vi.fn(),
    };

    service = new AlertLifecycleService(
      mockAlertRepo,
      mockWellRepo,
      mockAuditRepo,
    );
  });

  describe("Acknowledgement Lifecycle Transition", () => {
    it("transitions an ACTIVE alert to ACKNOWLEDGED", async () => {
      const result = await service.acknowledgeAlert(
        "alert-100",
        "user-eng-1",
        "DRILLING_ENGINEER",
      );

      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(result.acknowledgedBy).toBe("user-eng-1");
      expect(mockAlertRepo.updateStatus).toHaveBeenCalledWith(
        "alert-100",
        expect.objectContaining({
          status: AlertStatus.ACKNOWLEDGED,
          acknowledgedBy: "user-eng-1",
        }),
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_ACKNOWLEDGE",
          resourceId: "alert-100",
        }),
      );
    });

    it("rejects acknowledgement if alert is already ACKNOWLEDGED", async () => {
      vi.mocked(mockAlertRepo.findById).mockResolvedValue({
        ...sampleActiveAlert,
        status: AlertStatus.ACKNOWLEDGED,
      });

      await expect(
        service.acknowledgeAlert(
          "alert-100",
          "user-eng-1",
          "DRILLING_ENGINEER",
        ),
      ).rejects.toThrow("Alert is already acknowledged");
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects acknowledgement if alert is already RESOLVED", async () => {
      vi.mocked(mockAlertRepo.findById).mockResolvedValue({
        ...sampleActiveAlert,
        status: AlertStatus.RESOLVED,
      });

      await expect(
        service.acknowledgeAlert(
          "alert-100",
          "user-eng-1",
          "DRILLING_ENGINEER",
        ),
      ).rejects.toThrow("Cannot acknowledge an already resolved alert");
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("Resolution Lifecycle Transition", () => {
    it("rejects direct ACTIVE -> RESOLVED transition with BadRequest (must acknowledge first)", async () => {
      // Default mock has ACTIVE alert
      await expect(
        service.resolveAlert(
          "alert-100",
          "user-eng-1",
          "DRILLING_ENGINEER",
          "Attempted premature resolution.",
        ),
      ).rejects.toThrow(
        "Alert must be acknowledged before it can be resolved. Transition ACTIVE -> RESOLVED is not permitted.",
      );
      // Alert state must not have been mutated
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
      expect(mockAuditRepo.create).not.toHaveBeenCalled();
    });

    it("transitions an ACKNOWLEDGED alert to RESOLVED with notes via correct ACTIVE -> ACKNOWLEDGED -> RESOLVED sequence", async () => {
      const acknowledgedAlert: typeof sampleActiveAlert = {
        ...sampleActiveAlert,
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: "user-eng-1",
        acknowledgedAt: new Date("2026-09-28T12:05:00Z"),
      };

      // Simulate an already-acknowledged alert (result of the preceding ACKNOWLEDGE step)
      vi.mocked(mockAlertRepo.findById).mockResolvedValue(acknowledgedAlert);
      vi.mocked(mockAlertRepo.updateStatus).mockImplementation((id, data) =>
        Promise.resolve({
          ...acknowledgedAlert,
          ...data,
          updatedAt: new Date(),
        }),
      );

      const result = await service.resolveAlert(
        "alert-100",
        "user-eng-1",
        "DRILLING_ENGINEER",
        "Bit nozzle cleared after back-reaming.",
      );

      expect(result.status).toBe(AlertStatus.RESOLVED);
      expect(result.resolvedBy).toBe("user-eng-1");
      expect(result.resolutionNotes).toBe(
        "Bit nozzle cleared after back-reaming.",
      );
      expect(mockAlertRepo.updateStatus).toHaveBeenCalledWith(
        "alert-100",
        expect.objectContaining({
          status: AlertStatus.RESOLVED,
          resolvedBy: "user-eng-1",
          resolutionNotes: "Bit nozzle cleared after back-reaming.",
        }),
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_RESOLVE",
          resourceId: "alert-100",
        }),
      );
    });

    it("rejects resolution if alert is already RESOLVED", async () => {
      vi.mocked(mockAlertRepo.findById).mockResolvedValue({
        ...sampleActiveAlert,
        status: AlertStatus.RESOLVED,
      });

      await expect(
        service.resolveAlert("alert-100", "user-eng-1", "DRILLING_ENGINEER"),
      ).rejects.toThrow("Alert has already been resolved");
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("Alert Retrieval", () => {
    it("retrieves paginated alerts for a well", async () => {
      const result = await service.listAlertsForWell("well-100", {
        status: AlertStatus.ACTIVE,
        page: 1,
        pageSize: 20,
        sortOrder: "desc",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("alert-100");
      expect(result.pagination.totalItems).toBe(1);
    });

    it("retrieves alert details by ID", async () => {
      const result = await service.getAlertById("alert-100");
      expect(result.id).toBe("alert-100");
      expect(result.explanation).toContain("PRESSURE_SPIKE_DETECT");
    });

    it("throws not found when querying nonexistent alert", async () => {
      vi.mocked(mockAlertRepo.findById).mockResolvedValue(null);

      await expect(service.getAlertById("missing-alert")).rejects.toThrow(
        "Alert not found",
      );
    });
  });
});
