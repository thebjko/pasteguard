/**
 * Anthropic SSE stream transformer for unmasking PII and secrets
 *
 * Anthropic uses a different SSE format than OpenAI:
 * - event: message_start / content_block_start / content_block_delta / etc.
 * - data: {...}
 *
 * Text content comes in content_block_delta events with delta.type === "text_delta"
 */

import type { MaskingConfig } from "../../config";
import type { PlaceholderContext } from "../../masking/context";
import { flushMaskingBuffer, unmaskStreamChunk } from "../../pii/mask";
import { flushSecretsMaskingBuffer, unmaskSecretsStreamChunk } from "../../secrets/mask";
import type { ContentBlockDeltaEvent, TextDelta } from "./types";

/**
 * Creates a transform stream that unmasks Anthropic SSE content
 */
export function createAnthropicUnmaskingStream(
  source: ReadableStream<Uint8Array>,
  piiContext: PlaceholderContext | undefined,
  config: MaskingConfig,
  secretsContext?: PlaceholderContext,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  // Separate buffers per delta type to prevent cross-block contamination
  let textPiiBuffer = "";
  let textSecretsBuffer = "";
  let jsonPiiBuffer = "";
  let jsonSecretsBuffer = "";
  let lineBuffer = "";
  let pendingEventLine = "";

  return new ReadableStream({
    async start(controller) {
      const reader = source.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Flush remaining text buffers
            let flushed = "";

            if (textPiiBuffer && piiContext) {
              flushed = flushMaskingBuffer(textPiiBuffer, piiContext, config);
            } else if (textPiiBuffer) {
              flushed = textPiiBuffer;
            }

            if (textSecretsBuffer && secretsContext) {
              flushed += flushSecretsMaskingBuffer(textSecretsBuffer, secretsContext);
            } else if (textSecretsBuffer) {
              flushed += textSecretsBuffer;
            }

            // Send flushed content as final text delta
            if (flushed) {
              const finalEvent: ContentBlockDeltaEvent = {
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text: flushed },
              };
              controller.enqueue(
                encoder.encode(
                  `event: content_block_delta\ndata: ${JSON.stringify(finalEvent)}\n\n`,
                ),
              );
            }

            controller.close();
            break;
          }

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            // Buffer event type lines — emit together with their data line
            if (line.startsWith("event: ")) {
              pendingEventLine = `${line}\n`;
              continue;
            }

            // Process data lines
            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              try {
                const parsed = JSON.parse(data) as { type: string; delta?: { type: string } };

                if (parsed.type === "content_block_delta") {
                  // Process text deltas (response text)
                  if (parsed.delta?.type === "text_delta") {
                    const event = parsed as ContentBlockDeltaEvent;
                    const textDelta = event.delta as TextDelta;
                    let processedText = textDelta.text;

                    // Unmask PII
                    if (piiContext && processedText) {
                      const { output, remainingBuffer } = unmaskStreamChunk(
                        textPiiBuffer,
                        processedText,
                        piiContext,
                        config,
                      );
                      textPiiBuffer = remainingBuffer;
                      processedText = output;
                    }

                    // Unmask secrets
                    if (secretsContext && processedText) {
                      const { output, remainingBuffer } = unmaskSecretsStreamChunk(
                        textSecretsBuffer,
                        processedText,
                        secretsContext,
                      );
                      textSecretsBuffer = remainingBuffer;
                      processedText = output;
                    }

                    // Only emit if we have content; if not, discard pending event line too
                    if (processedText) {
                      if (pendingEventLine) controller.enqueue(encoder.encode(pendingEventLine));
                      const modifiedEvent = {
                        ...parsed,
                        delta: { ...textDelta, text: processedText },
                      };
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(modifiedEvent)}\n`),
                      );
                    }
                    pendingEventLine = "";
                  } else if (parsed.delta?.type === "input_json_delta") {
                    // Process tool input deltas — unmask placeholders in JSON fragments
                    const delta = parsed.delta as { type: string; partial_json: string };
                    let partialJson = delta.partial_json;

                    if (secretsContext && partialJson) {
                      const { output, remainingBuffer } = unmaskSecretsStreamChunk(
                        jsonSecretsBuffer,
                        partialJson,
                        secretsContext,
                      );
                      jsonSecretsBuffer = remainingBuffer;
                      partialJson = output;
                    }
                    if (piiContext && partialJson) {
                      const { output, remainingBuffer } = unmaskStreamChunk(
                        jsonPiiBuffer,
                        partialJson,
                        piiContext,
                        config,
                      );
                      jsonPiiBuffer = remainingBuffer;
                      partialJson = output;
                    }

                    const modifiedEvent = {
                      ...parsed,
                      delta: { ...delta, partial_json: partialJson },
                    };
                    if (pendingEventLine) controller.enqueue(encoder.encode(pendingEventLine));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(modifiedEvent)}\n`));
                    pendingEventLine = "";
                  } else {
                    // Pass through other delta types unchanged
                    if (pendingEventLine) controller.enqueue(encoder.encode(pendingEventLine));
                    controller.enqueue(encoder.encode(`data: ${data}\n`));
                    pendingEventLine = "";
                  }
                } else {
                  // Pass through non-delta events unchanged
                  if (pendingEventLine) controller.enqueue(encoder.encode(pendingEventLine));
                  controller.enqueue(encoder.encode(`data: ${data}\n`));
                  pendingEventLine = "";
                }
              } catch {
                // Pass through unparseable data
                if (pendingEventLine) controller.enqueue(encoder.encode(pendingEventLine));
                controller.enqueue(encoder.encode(`${line}\n`));
                pendingEventLine = "";
              }
              continue;
            }

            // Pass through empty lines and other content
            if (line.trim() === "") {
              controller.enqueue(encoder.encode("\n"));
            } else {
              controller.enqueue(encoder.encode(`${line}\n`));
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}
