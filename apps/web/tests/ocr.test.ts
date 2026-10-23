import test from "node:test";
import assert from "node:assert/strict";
import { needsOcr, transcribePages, validateOcrPages, markOcrFieldsForReview } from "../lib/ocr";
test("OCR detects empty or sparse scanned pages while preserving text-rich pages",()=>{
  assert.equal(needsOcr("\n-- 1 of 4 --\n"),true); assert.equal(needsOcr("Scanned invoice"),true);
  assert.equal(needsOcr("Invoice INV-123 Date 2026-10-23 Supplier Example Company Total MYR 125.50"),false);
});
test("OCR requires every requested page and preserves exact source strings",()=>{
  assert.deepEqual(validateOcrPages([{page:2,text:" Total MYR -1,250.50\nDate 05/01/yyyy "}], [2]),[{page:2,text:"Total MYR -1,250.50\nDate 05/01/yyyy"}]);
  assert.throws(()=>validateOcrPages([{page:1,text:"invented"}], [2]),/incomplete/);
  assert.throws(()=>validateOcrPages([{page:2,text:"one"},{page:2,text:"two"}], [2]),/incomplete/);
  assert.throws(()=>validateOcrPages([{page:1,text:12}], [1]),/incomplete/);
});
test("OCR sends images only to DeepSeek with transcription guardrails and rejects truncation",async()=>{
  const before=global.fetch; const key=process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY="test-secret";
  try {
    global.fetch=(async(url,options)=>{
      assert.equal(url,"https://api.deepseek.com/chat/completions");
      const body=JSON.parse(String(options?.body)); assert.match(body.messages[0].content,/untrusted source data/); assert.match(body.messages[0].content,/do not analyse, calculate/);
      assert.equal(body.messages[1].content[0].text,"Transcribe source page 3."); assert.match(body.messages[1].content[1].image_url.url,/^data:image\/png;base64,/);
      return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify({pages:[{page:3,text:"Total MYR 125.50"}]})}}]});
    }) as typeof fetch;
    assert.deepEqual(await transcribePages([{page:3,data:new Uint8Array([1,2,3])}]),[{page:3,text:"Total MYR 125.50"}]);
    global.fetch=(async()=>Response.json({choices:[{finish_reason:"length",message:{content:"partial"}}]})) as typeof fetch;
    await assert.rejects(transcribePages([{page:1,data:new Uint8Array()}]),/too long/);
    global.fetch=(async()=>Response.json({}, {status:402})) as typeof fetch;
    await assert.rejects(transcribePages([{page:1,data:new Uint8Array()}]),/insufficient credit/);
  } finally {global.fetch=before;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;}
});

test("OCR-derived fields remain review-required without changing recognised values",()=>{
  const fields={document:{date:{value:"2026-10-23",confidence:.88,needs_human:false}},totals:{total:{value:125.50,confidence:.9,needs_human:false}}};
  markOcrFieldsForReview(fields); assert.equal(fields.document.date.value,"2026-10-23");assert.equal(fields.totals.total.value,125.5);assert.equal(fields.totals.total.confidence,.7);assert.equal(fields.document.date.needs_human,true);
});
