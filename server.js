const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

const rooms = new Map(); // roomCode -> { users:Set, answers: Map }

io.on("connection", (socket) => {
  let roomCode = null;

  socket.on("join", ({ room }) => {
    roomCode = (room || "").trim().toUpperCase();
    if (!roomCode) return;

    if (!rooms.has(roomCode)) rooms.set(roomCode, { users: new Set(), answers: new Map() });
    const r = rooms.get(roomCode);
    if (r.users.size >= 2) {
      socket.emit("errorMsg", "Room full.");
      return;
    }

    r.users.add(socket.id);
    socket.join(roomCode);

    socket.emit("joined", { room: roomCode });
    io.to(roomCode).emit("roomUpdate", { count: r.users.size });
    if (r.users.size === 2) io.to(roomCode).emit("ready");
  });

  socket.on("answer", (text) => {
    if (!roomCode || !rooms.has(roomCode)) return;
    const r = rooms.get(roomCode);
    r.answers.set(socket.id, text);

    if (r.answers.size === r.users.size) {
      const results = [];
      for (const id of r.users) {
        results.push({ who: id === socket.id ? "You" : "Partner", answer: r.answers.get(id) });
      }
      io.to(roomCode).emit("results", results);
    }
  });

  socket.on("disconnect", () => {
    if (!roomCode || !rooms.has(roomCode)) return;
    const r = rooms.get(roomCode);
    r.users.delete(socket.id);
    r.answers.delete(socket.id);
    if (r.users.size === 0) rooms.delete(roomCode);
    else io.to(roomCode).emit("roomUpdate", { count: r.users.size });
  });
});

server.listen(3000, () => console.log("http://localhost:3000"));
