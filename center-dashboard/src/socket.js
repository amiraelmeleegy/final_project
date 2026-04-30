import { io } from "socket.io-client";
import { API_URL } from "./config";

export const socket = io(API_URL, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 700,
  reconnectionDelayMax: 4000,
  timeout: 20000,
});