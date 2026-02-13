import {
  answerAIQuestion,
  listAIActivity,
  retrieveAIContext,
} from "./ai.js";

export function retrieve(fundId, payload) {
  return retrieveAIContext(fundId, payload);
}

export function answer(fundId, payload) {
  return answerAIQuestion(fundId, payload);
}

export function getAIActivity(fundId, params = {}) {
  return listAIActivity(fundId, params);
}
