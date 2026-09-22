import { Gateway } from "../../src/gateway/gateway.js";

export async function runGatewayTests(): Promise<boolean> {
  const gateway = new Gateway();
  let allPassed = true;

  console.log("\n[Gateway Tests]");

  // 1. Valid request test
  const validRes = gateway.handle({
    question: "What is our leave policy?",
    user: {
      userId: "user-001",
      tenantId: "tenant-001",
      roles: ["employee"]
    }
  });

  if (validRes.accepted && validRes.context && validRes.context.requestId) {
    console.log("  ✓ Valid request accepted and context generated");
  } else {
    console.error("  ✗ Valid request rejected");
    allPassed = false;
  }

  // 2. Empty question validation test
  const invalidRes = gateway.handle({
    question: "",
    user: {
      userId: "user-001",
      tenantId: "tenant-001",
      roles: ["employee"]
    }
  });

  if (!invalidRes.accepted && invalidRes.error?.code === "INVALID_REQUEST") {
    console.log("  ✓ Empty question rejected with INVALID_REQUEST");
  } else {
    console.error("  ✗ Empty question was not properly rejected");
    allPassed = false;
  }

  // 3. Rate limiting test
  const flooderUser = {
    userId: "flood-test-user",
    tenantId: "tenant-001",
    roles: ["employee"]
  };

  let throttled = false;
  for (let i = 0; i < 15; i++) {
    const res = gateway.handle({
      question: `Question iteration ${i}`,
      user: flooderUser
    });
    if (!res.accepted && res.error?.code === "RATE_LIMITED") {
      throttled = true;
      break;
    }
  }

  if (throttled) {
    console.log("  ✓ Gateway sliding-window rate limit triggers RATE_LIMITED");
  } else {
    console.error("  ✗ Gateway rate limiter failed to throttle request flood");
    allPassed = false;
  }

  return allPassed;
}
