import { simulatedCheck } from './simulated'

// The one place the app asks "should a human look closely at this photo?".
// To use a real model (e.g. WebLLM in the browser), replace this function's
// body and return the same shape: { engine, flagged, rules: [{ label, result, reason }] }.
export async function checkSubmission(submission) {
  await new Promise((resolve) => setTimeout(resolve, 900))
  return simulatedCheck(submission)
}
