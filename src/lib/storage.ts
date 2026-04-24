// Backwards-compat shim. The real implementation now lives in api.ts and
// talks to the Express + MongoDB backend in /backend.
export {
  type Application as Bot,
  type ApplicationStatus as BotStatus,
  type User,
  getApplicationStatus as getBotStatus,
  formatDateTime,
} from "./api";
