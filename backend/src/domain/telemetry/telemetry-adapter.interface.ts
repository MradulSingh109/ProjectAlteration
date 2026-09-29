import { CreateTelemetryInput } from "./telemetry.entity";

/**
 * Transport-independent ingestion adapter contract.
 *
 * Encapsulates translation from transport-specific payloads (HTTP, or future
 * MQTT, Kafka, WITSML, WITS0 packets) into the canonical domain input model.
 */
export interface ITelemetrySourceAdapter<TInput = unknown> {
  /**
   * Adapts a raw transport packet into a canonical domain CreateTelemetryInput.
   * Performs structural and physical validation.
   */
  adapt(rawInput: TInput): Promise<CreateTelemetryInput> | CreateTelemetryInput;
}
