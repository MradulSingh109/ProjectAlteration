import { PrismaClient } from "@prisma/client";

const BASE_URL = "http://localhost:3002/api/v1";
const prisma = new PrismaClient();

const results = [];

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
  results.push(message);
}

async function main() {
  console.log("=== STARTING STEP 11 LIVE VERIFICATION AGAINST NEON ===");

  const timestamp = Date.now();
  const testEmailPrefix = `step11_corr_${timestamp}`;
  const engineerEmail = `${testEmailPrefix}_eng@nwis.gov.in`;
  const viewerEmail = `${testEmailPrefix}_view@nwis.gov.in`;
  const geologistEmail = `${testEmailPrefix}_geo@nwis.gov.in`;
  const testPassword = "SecurePassword123!";

  let engineerToken = null;
  let engineerCsrf = null;
  let viewerToken = null;
  let viewerCsrf = null;
  let geologistToken = null;
  let geologistCsrf = null;

  let testWell = null;
  const createdReadingIds = [];
  const createdAlertIds = [];

  try {
    // -------------------------------------------------------------
    // SETUP: Users & Well
    // -------------------------------------------------------------
    console.log("\n--- Setup: Registering Test Actors ---");

    // 1. Register Drilling Engineer
    const engReg = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: engineerEmail,
        password: testPassword,
        role: "DRILLING_ENGINEER",
      }),
    });
    const engRegData = await engReg.json();
    assert(engReg.status === 201, "Drilling Engineer registered successfully");

    await prisma.user.update({
      where: { email: engineerEmail },
      data: { role: "DRILLING_ENGINEER" },
    });

    // Login Engineer to get session & CSRF
    const engLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: engineerEmail, password: testPassword }),
    });
    const engLoginData = await engLogin.json();
    assert(engLogin.status === 200, "Engineer logged in");
    const engCookies = engLogin.headers.get("set-cookie") || "";
    const engCookieHeader = engCookies
      .split(",")
      .map((c) => c.split(";")[0])
      .join("; ");
    engineerToken = engLoginData.data.accessToken;
    engineerCsrf = engLoginData.data.csrfToken;

    // 2. Register Viewer
    const viewReg = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: viewerEmail,
        password: testPassword,
        role: "VIEWER",
      }),
    });
    assert(viewReg.status === 201, "Viewer registered successfully");
    const viewLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: viewerEmail, password: testPassword }),
    });
    assert(viewLogin.status === 200, "Viewer logged in");
    const viewCookies = viewLogin.headers.get("set-cookie") || "";
    const viewCookieHeader = viewCookies
      .split(",")
      .map((c) => c.split(";")[0])
      .join("; ");
    const viewLoginData = await viewLogin.json();
    viewerToken = viewLoginData.data?.accessToken || null;
    viewerCsrf = viewLoginData.data?.csrfToken || null;

    // 3. Register Geologist
    const geoReg = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: geologistEmail,
        password: testPassword,
        role: "GEOLOGIST",
      }),
    });
    assert(geoReg.status === 201, "Geologist registered successfully");

    await prisma.user.update({
      where: { email: geologistEmail },
      data: { role: "GEOLOGIST" },
    });

    const geoLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: geologistEmail, password: testPassword }),
    });
    assert(geoLogin.status === 200, "Geologist logged in");
    const geoCookies = geoLogin.headers.get("set-cookie") || "";
    const geoCookieHeader = geoCookies
      .split(",")
      .map((c) => c.split(";")[0])
      .join("; ");
    const geoLoginData = await geoLogin.json();
    geologistToken = geoLoginData.data?.accessToken || null;
    geologistCsrf = geoLoginData.data?.csrfToken || null;

    // 4. Create Test Well in Neon
    testWell = await prisma.well.create({
      data: {
        wellId: `WELL-VERIF-${timestamp}`,
        name: `Correction Verification Well ${timestamp}`,
        field: "OIL INDIA LIMITED",
        latitude: 27.48,
        longitude: 95.35,
        plannedDepthMd: 10000.0,
        plannedDepthTvd: 9000.0,
        status: "DRILLING",
      },
    });
    assert(testWell.id != null, `Test well created: ${testWell.wellId}`);

    // Helper to insert telemetry reading in DB
    const insertReading = async (
      seq,
      offsetSeconds,
      flowIn,
      flowOut,
      pressure = 3000,
      torque = 10000,
    ) => {
      const readingTime = new Date(Date.now() - (1000 - offsetSeconds) * 1000);
      const r = await prisma.telemetryReading.create({
        data: {
          wellId: testWell.id,
          sourceId: "VERIF_RIG_01",
          sequenceNumber: BigInt(seq),
          timestamp: readingTime,
          depthMd: 2500.0 + seq * 0.5,
          standpipePressure: pressure,
          surfaceTorque: torque,
          flowRateIn: flowIn,
          flowRateOut: flowOut,
        },
      });
      createdReadingIds.push(r.id);
      return r;
    };

    // -------------------------------------------------------------
    // PART A: Existing Alert Engine Behavior (Single Threshold)
    // -------------------------------------------------------------
    console.log("\n--- Part A: Verifying Pressure Spike Alert ---");
    const spikeReading = await insertReading(10, 10, 500, 490, 4800, 12000); // 4800 > 4500 psi
    const spikeEvalRes = await fetch(
      `${BASE_URL}/telemetry/readings/${spikeReading.id}/evaluate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      },
    );
    const spikeEvalData = await spikeEvalRes.json();
    if (spikeEvalRes.status !== 200) {
      console.error("403 error:", spikeEvalData);
    }
    assert(spikeEvalRes.status === 200, "Single reading evaluate returned 200");
    assert(
      spikeEvalData.data.alertsTriggeredCount === 1,
      "Pressure spike triggered 1 alert",
    );
    assert(
      spikeEvalData.data.alerts[0].ruleCode === "PRESSURE_SPIKE_DETECT",
      "Rule code is PRESSURE_SPIKE_DETECT",
    );
    createdAlertIds.push(spikeEvalData.data.alerts[0].id);

    // -------------------------------------------------------------
    // PART B: Mud Flow Discrepancy (Sustained vs Single vs Interrupted)
    // -------------------------------------------------------------
    console.log(
      "\n--- Part B: Verifying Mud Flow Discrepancy Sustained Semantics ---",
    );

    // B1: Normal flow -> no alert
    const normR = await insertReading(20, 20, 500, 490); // delta = 10 <= 50 gpm
    const normRes = await fetch(
      `${BASE_URL}/telemetry/readings/${normR.id}/evaluate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      },
    );
    const normData = await normRes.json();
    assert(
      normData.data.alertsTriggeredCount === 0,
      "B1: Normal mud flow produced 0 alerts",
    );

    // B2: Single reading above threshold (delta = 80 gpm > 50) -> no sustained alert
    const singleHighR = await insertReading(21, 21, 500, 420); // delta = 80 > 50 gpm
    const singleHighRes = await fetch(
      `${BASE_URL}/telemetry/readings/${singleHighR.id}/evaluate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      },
    );
    const singleHighData = await singleHighRes.json();
    assert(
      singleHighData.data.alertsTriggeredCount === 0,
      "B2: Single reading discrepancy produced 0 sustained alerts",
    );

    // Insert a normal reading to break the streak from B2
    const breakStreakR = await insertReading(25, 25, 500, 490); // delta = 10 <= 50 gpm

    // B3: Required sustained sequence: 3 consecutive readings above threshold
    // Reading 1: seq 31 (delta 80)
    // Reading 2: seq 32 (delta 85)
    // Reading 3: seq 33 (delta 90)
    const m1 = await insertReading(31, 31, 500, 420); // delta = 80
    const m2 = await insertReading(32, 32, 500, 415); // delta = 85
    const m3 = await insertReading(33, 33, 500, 410); // delta = 90

    // Evaluate m1 -> 0 alerts (1 of 3)
    const m1Res = await (
      await fetch(`${BASE_URL}/telemetry/readings/${m1.id}/evaluate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      })
    ).json();
    assert(
      m1Res.data.alertsTriggeredCount === 0,
      "B3: 1st discrepant reading -> 0 alerts",
    );

    // Evaluate m2 -> 0 alerts (2 of 3)
    const m2Res = await (
      await fetch(`${BASE_URL}/telemetry/readings/${m2.id}/evaluate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      })
    ).json();
    if (m2Res.data.alertsTriggeredCount !== 0) {
      console.error("m2Res triggered alerts:", m2Res.data.alerts);
    }
    assert(
      m2Res.data.alertsTriggeredCount === 0,
      "B3: 2nd consecutive discrepant reading -> 0 alerts",
    );

    // Evaluate m3 -> 1 alert (3 of 3 consecutive!)
    const m3Res = await (
      await fetch(`${BASE_URL}/telemetry/readings/${m3.id}/evaluate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      })
    ).json();
    assert(
      m3Res.data.alertsTriggeredCount === 1,
      "B3: 3rd consecutive discrepant reading triggered 1 sustained alert",
    );
    const mudAlert = m3Res.data.alerts[0];
    assert(
      mudAlert.alertType === "MUD_FLOW_DISCREPANCY",
      "B3: Alert type is MUD_FLOW_DISCREPANCY",
    );
    assert(mudAlert.severity === "CRITICAL", "B3: Severity is CRITICAL");
    assert(
      mudAlert.explanation.includes("flowRateIn") &&
        mudAlert.explanation.includes("flowRateOut"),
      "B3: Explanation includes flowRateIn and flowRateOut",
    );
    assert(
      mudAlert.explanation.includes("calculated discrepancy") &&
        mudAlert.explanation.includes("configured threshold"),
      "B3: Explanation includes calculated discrepancy and configured threshold",
    );
    assert(
      mudAlert.evidence.observedValue.consecutiveReadingsObserved === 3,
      "B3: Evidence records 3 consecutive readings observed",
    );
    createdAlertIds.push(mudAlert.id);

    // B4: Interrupted sequence: reading above (seq 41), normal reading (seq 42), reading above (seq 43)
    const int1 = await insertReading(41, 41, 500, 420); // delta = 80 > 50
    const intNormal = await insertReading(42, 42, 500, 490); // delta = 10 <= 50 (normal)
    const int3 = await insertReading(43, 43, 500, 410); // delta = 90 > 50

    const int3Res = await (
      await fetch(`${BASE_URL}/telemetry/readings/${int3.id}/evaluate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      })
    ).json();
    assert(
      int3Res.data.alertsTriggeredCount === 0,
      "B4: Interrupted sequence reset sustained counter -> 0 alerts",
    );

    // -------------------------------------------------------------
    // PART C: Range Evaluation & Validation Hardening
    // -------------------------------------------------------------
    console.log(
      "\n--- Part C: Verifying Range Evaluation & Validation Hardening ---",
    );

    const baseFrom = new Date(Date.now() - 3600 * 1000).toISOString();
    const baseTo = new Date().toISOString();

    // C1: Valid range succeeds
    const validRangeRes = await fetch(
      `${BASE_URL}/wells/${testWell.id}/telemetry/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
        body: JSON.stringify({
          from: baseFrom,
          to: baseTo,
          limit: 50,
        }),
      },
    );
    const validRangeData = await validRangeRes.json();
    assert(
      validRangeRes.status === 200,
      "C1: Valid bounded range evaluation returned 200 OK",
    );
    assert(
      validRangeData.data.readingsEvaluatedCount > 0,
      `C1: Evaluated ${validRangeData.data.readingsEvaluatedCount} readings`,
    );

    // C2: Excessive range duration (> 24 hours) returns 400
    const excessiveFrom = new Date(Date.now() - 30 * 3600 * 1000).toISOString(); // 30 hours ago
    const excessiveRangeRes = await fetch(
      `${BASE_URL}/wells/${testWell.id}/telemetry/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
        body: JSON.stringify({
          from: excessiveFrom,
          to: baseTo,
          limit: 50,
        }),
      },
    );
    const excessiveRangeData = await excessiveRangeRes.json();
    assert(
      excessiveRangeRes.status === 400,
      "C2: Excessive range duration (>24h) returned 400 Bad Request",
    );
    assert(
      excessiveRangeData.error?.message?.includes("24 hours"),
      "C2: Error message explicitly identifies 24-hour limit",
    );

    // C3: Excessive limit (> 100 readings) returns 400
    const excessiveLimitRes = await fetch(
      `${BASE_URL}/wells/${testWell.id}/telemetry/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
        body: JSON.stringify({
          from: baseFrom,
          to: baseTo,
          limit: 101,
        }),
      },
    );
    const excessiveLimitData = await excessiveLimitRes.json();
    assert(
      excessiveLimitRes.status === 400,
      "C3: Excessive limit (>100) returned 400 Bad Request",
    );
    assert(
      excessiveLimitData.error?.message?.includes("100"),
      "C3: Error message identifies 100 limit",
    );

    // C4: Invalid range: from > to returns 400
    const reversedRangeRes = await fetch(
      `${BASE_URL}/wells/${testWell.id}/telemetry/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
        body: JSON.stringify({
          from: baseTo,
          to: baseFrom,
        }),
      },
    );
    assert(
      reversedRangeRes.status === 400,
      "C4: Inverted range (from > to) returned 400 Bad Request",
    );

    // -------------------------------------------------------------
    // PART D: Repeated Evaluation Idempotency
    // -------------------------------------------------------------
    console.log("\n--- Part D: Verifying Idempotent Repeated Evaluation ---");
    const countBefore = await prisma.alert.count({
      where: { wellId: testWell.id },
    });

    // Repeat evaluate range
    const repeatRes = await fetch(
      `${BASE_URL}/wells/${testWell.id}/telemetry/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
        body: JSON.stringify({ from: baseFrom, to: baseTo, limit: 50 }),
      },
    );
    assert(repeatRes.status === 200, "D: Repeat range evaluation returned 200");
    const countAfter = await prisma.alert.count({
      where: { wellId: testWell.id },
    });
    assert(
      countBefore === countAfter,
      "D: Alert count is identical after repeat evaluation (zero duplicates created)",
    );

    // -------------------------------------------------------------
    // PART E: Alert Lifecycle (ACTIVE -> ACKNOWLEDGED -> RESOLVED)
    // -------------------------------------------------------------
    console.log("\n--- Part E: Verifying Alert Lifecycle State Machine ---");
    const targetAlertId = mudAlert.id;

    // 1. Direct resolve from ACTIVE -> rejected 400
    const invalidResolveRes = await fetch(
      `${BASE_URL}/alerts/${targetAlertId}/resolve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
        body: JSON.stringify({ resolutionNotes: "Invalid direct resolve" }),
      },
    );
    assert(
      invalidResolveRes.status === 400,
      "E: Direct transition ACTIVE -> RESOLVED rejected with 400",
    );

    // 2. Acknowledge: ACTIVE -> ACKNOWLEDGED
    const ackRes = await fetch(
      `${BASE_URL}/alerts/${targetAlertId}/acknowledge`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      },
    );
    const ackData = await ackRes.json();
    assert(
      ackRes.status === 200,
      "E: Transition ACTIVE -> ACKNOWLEDGED returned 200 OK",
    );
    assert(
      ackData.data.status === "ACKNOWLEDGED",
      "E: Alert status is now ACKNOWLEDGED",
    );
    assert(
      ackData.data.acknowledgedAt != null,
      "E: acknowledgedAt is recorded",
    );

    // 3. Resolve: ACKNOWLEDGED -> RESOLVED
    const resolveRes = await fetch(
      `${BASE_URL}/alerts/${targetAlertId}/resolve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
        body: JSON.stringify({
          resolutionNotes: "Mud pit levels stabilized and sensor calibrated.",
        }),
      },
    );
    const resolveData = await resolveRes.json();
    assert(
      resolveRes.status === 200,
      "E: Transition ACKNOWLEDGED -> RESOLVED returned 200 OK",
    );
    assert(
      resolveData.data.status === "RESOLVED",
      "E: Alert status is now RESOLVED",
    );
    assert(
      resolveData.data.resolutionNotes ===
        "Mud pit levels stabilized and sensor calibrated.",
      "E: Resolution notes recorded",
    );

    // 4. Reopen from RESOLVED -> rejected 400
    const reopenRes = await fetch(
      `${BASE_URL}/alerts/${targetAlertId}/acknowledge`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${engineerToken}`,
          "X-CSRF-Token": engineerCsrf,
          Cookie: engCookieHeader,
        },
      },
    );
    assert(
      reopenRes.status === 400,
      "E: Transition RESOLVED -> ACKNOWLEDGED rejected (terminal state)",
    );

    // -------------------------------------------------------------
    // PART F: Role-Based Access Control (RBAC)
    // -------------------------------------------------------------
    console.log("\n--- Part F: Verifying RBAC Enforcement ---");

    // Viewer forbidden from evaluate range (403)
    const viewerEvalRes = await fetch(
      `${BASE_URL}/wells/${testWell.id}/telemetry/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${viewerToken}`,
          "X-CSRF-Token": viewerCsrf,
          Cookie: viewCookieHeader,
        },
        body: JSON.stringify({ from: baseFrom, to: baseTo }),
      },
    );
    if (viewerEvalRes.status !== 403) {
      const viewerEvalData = await viewerEvalRes.json();
      console.error(
        `F: VIEWER evaluate returned ${viewerEvalRes.status}:`,
        viewerEvalData,
      );
    }
    assert(
      viewerEvalRes.status === 403,
      "F: VIEWER evaluate range forbidden with 403",
    );

    // Viewer forbidden from acknowledging (403)
    const viewerAckRes = await fetch(
      `${BASE_URL}/alerts/${targetAlertId}/acknowledge`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${viewerToken}`,
          "X-CSRF-Token": viewerCsrf,
          Cookie: viewCookieHeader,
        },
      },
    );
    assert(
      viewerAckRes.status === 403,
      "F: VIEWER acknowledge alert forbidden with 403",
    );

    // Viewer allowed to read alerts (200)
    const viewerReadRes = await fetch(
      `${BASE_URL}/wells/${testWell.id}/alerts`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${viewerToken}`,
          Cookie: viewCookieHeader,
        },
      },
    );
    assert(
      viewerReadRes.status === 200,
      "F: VIEWER read alerts permitted with 200",
    );

    // Geologist allowed to evaluate range (200)
    const geoEvalRes = await fetch(
      `${BASE_URL}/wells/${testWell.id}/telemetry/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${geologistToken}`,
          "X-CSRF-Token": geologistCsrf,
          Cookie: geoCookieHeader,
        },
        body: JSON.stringify({ from: baseFrom, to: baseTo }),
      },
    );
    assert(
      geoEvalRes.status === 200,
      "F: GEOLOGIST evaluate range permitted with 200",
    );

    // -------------------------------------------------------------
    // PART G: Durable Audit Logging
    // -------------------------------------------------------------
    console.log("\n--- Part G: Verifying Durable Audit Logging ---");
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        wellId: testWell.id,
      },
      orderBy: { createdAt: "asc" },
    });
    assert(
      auditLogs.length > 0,
      `G: Recorded ${auditLogs.length} audit log entries for test well`,
    );

    const alertGenerateLogs = auditLogs.filter(
      (l) => l.action === "ALERT_GENERATE",
    );
    assert(alertGenerateLogs.length > 0, "G: Found ALERT_GENERATE audit logs");

    const alertAckLogs = auditLogs.filter(
      (l) => l.action === "ALERT_ACKNOWLEDGE",
    );
    assert(alertAckLogs.length > 0, "G: Found ALERT_ACKNOWLEDGE audit logs");

    const alertResolveLogs = auditLogs.filter(
      (l) => l.action === "ALERT_RESOLVE",
    );
    assert(alertResolveLogs.length > 0, "G: Found ALERT_RESOLVE audit logs");

    // Verify zero secrets in details JSON
    for (const log of auditLogs) {
      const detailsStr = JSON.stringify(log.details || {});
      assert(
        !detailsStr.includes("token") && !detailsStr.includes("password"),
        "G: Audit log contains zero secrets",
      );
    }

    console.log("\n🎉 ALL LIVE RUNTIME VERIFICATION CHECKS PASSED!");
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Synthetic Data
    // -------------------------------------------------------------
    console.log("\n--- Cleaning Up Synthetic Test Data ---");
    try {
      if (testWell) {
        await prisma.alert.deleteMany({ where: { wellId: testWell.id } });
        await prisma.telemetryReading.deleteMany({
          where: { wellId: testWell.id },
        });
        await prisma.auditLog.deleteMany({ where: { wellId: testWell.id } });
        await prisma.well.delete({ where: { id: testWell.id } });
      }
      await prisma.session.deleteMany({
        where: {
          user: {
            email: {
              in: [engineerEmail, viewerEmail, geologistEmail],
            },
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [engineerEmail, viewerEmail, geologistEmail],
          },
        },
      });
      console.log("✅ Synthetic test data successfully cleaned up.");
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Verification execution failed:", err);
  process.exit(1);
});
