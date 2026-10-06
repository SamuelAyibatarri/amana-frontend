// Vitest setup: isolated env. NEVER hit network/D1/Paystack.
(process.env as any).NODE_ENV = "test";
process.env.SHARED_SECRET ??= "test-shared-secret";
process.env.PIN_PEPPER ??= "test-pepper-please-change-1234567890";
process.env.PAYSTACK_SECRET_KEY ??= "sk_test_fake0123456789";
process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret";
process.env.BETTER_AUTH_URL ??= "http://localhost:8787";
process.env.FRONTEND_URL ??= "http://localhost:8787";
process.env.AZURE_BACKEND_URL ??= "";
process.env.KYC_WEBHOOK_URL ??= "";
