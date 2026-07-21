import crypto from "crypto";

export async function downloadWithLimit(response, maxBytes) {
  if (!response.body) {
    throw new Error("Response body is empty or not readable.");
  }
  
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredSize = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredSize) && declaredSize > maxBytes) {
      throw new Error(`Content-Length (${declaredSize}) exceeds maximum allowed size (${maxBytes}).`);
    }
  }

  const reader = response.body.getReader();
  let totalBytes = 0;
  const chunks = [];
  const hash = crypto.createHash('sha256');

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          throw new Error(`Stream exceeded maximum allowed size of ${maxBytes} bytes.`);
        }
        chunks.push(value);
        hash.update(value);
      }
    }
  } finally {
    // Ensure we release the lock and cancel the reader (aborts the fetch if it was still streaming)
    reader.cancel().catch(() => {});
  }
  
  // Combine all chunks into a single Buffer
  const buffer = Buffer.concat(chunks);
  
  return {
    buffer,
    size: totalBytes,
    sha256: hash.digest('hex')
  };
}
