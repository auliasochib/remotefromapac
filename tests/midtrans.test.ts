import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "../src/lib/midtrans";

const SERVER_KEY = "test-server-key";

afterEach(() => {
  delete process.env.MIDTRANS_SERVER_KEY;
});

function sign(orderId: string, statusCode: string, grossAmount: string) {
  return crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${SERVER_KEY}`)
    .digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed notification", () => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    const orderId = "RFA-P-1";
    const statusCode = "200";
    const grossAmount = "99000.00";
    expect(
      verifyWebhookSignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey: sign(orderId, statusCode, grossAmount),
      })
    ).toBe(true);
  });

  it("rejects a tampered signature", () => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    expect(
      verifyWebhookSignature({
        orderId: "RFA-P-1",
        statusCode: "200",
        grossAmount: "99000.00",
        signatureKey: "0".repeat(128),
      })
    ).toBe(false);
  });

  it("rejects when the amount differs from the signature input", () => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    expect(
      verifyWebhookSignature({
        orderId: "RFA-P-1",
        statusCode: "200",
        grossAmount: "1.00", // attacker downgrades the amount
        signatureKey: sign("RFA-P-1", "200", "99000.00"),
      })
    ).toBe(false);
  });

  it("always fails without a configured server key", () => {
    expect(
      verifyWebhookSignature({
        orderId: "RFA-P-1",
        statusCode: "200",
        grossAmount: "99000.00",
        signatureKey: sign("RFA-P-1", "200", "99000.00"),
      })
    ).toBe(false);
  });
});
