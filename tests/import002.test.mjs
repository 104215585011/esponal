import assert from "node:assert/strict";
import test from "node:test";

test("IMPORT-1 v2 COS presign helpers generate Tencent COS S3-compatible signed URLs", async () => {
  const { presignGet, presignPut } = await import("../src/lib/storage/cos.ts");

  const env = {
    COS_SECRET_ID: process.env.COS_SECRET_ID,
    COS_SECRET_KEY: process.env.COS_SECRET_KEY,
    COS_BUCKET: process.env.COS_BUCKET,
    COS_REGION: process.env.COS_REGION,
  };

  process.env.COS_SECRET_ID = "test-secret-id";
  process.env.COS_SECRET_KEY = "test-secret-key";
  process.env.COS_BUCKET = "esponall-1311817841";
  process.env.COS_REGION = "ap-guangzhou";

  try {
    const putUrl = await presignPut({
      key: "imports/user-1/book.epub",
      contentType: "application/epub+zip",
    });
    const getUrl = await presignGet({
      key: "imports/user-1/book.epub",
      responseContentDisposition: "inline",
      responseContentType: "application/epub+zip",
    });

    assert.match(putUrl, /^https:\/\/esponall-1311817841\.cos\.ap-guangzhou\.myqcloud\.com\/imports\/user-1\/book\.epub\?/);
    assert.match(putUrl, /X-Amz-Algorithm=AWS4-HMAC-SHA256/);
    assert.match(putUrl, /X-Amz-Credential=test-secret-id%2F/);
    assert.match(putUrl, /X-Amz-Signature=/);
    assert.match(putUrl, /X-Amz-SignedHeaders=host/);
    assert.match(getUrl, /X-Amz-Expires=900/);
    assert.match(getUrl, /response-content-disposition=inline/);
    assert.match(getUrl, /response-content-type=application%2Fepub%2Bzip/);
  } finally {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("IMPORT-1 v2 COS helpers fail clearly when storage env is missing", async () => {
  const { presignGet } = await import("../src/lib/storage/cos.ts");
  const oldSecretId = process.env.COS_SECRET_ID;
  delete process.env.COS_SECRET_ID;

  try {
    await assert.rejects(
      () => presignGet({ key: "imports/user-1/book.pdf" }),
      /Missing COS_SECRET_ID/,
    );
  } finally {
    if (oldSecretId !== undefined) {
      process.env.COS_SECRET_ID = oldSecretId;
    }
  }
});
