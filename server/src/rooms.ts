import { WebSocket } from 'ws';
import { ServerMessage } from './types.js';

interface ClientConnection {
  ws: WebSocket;
  deviceId?: string;
  roomCode: string;
  roomId: string;
}

class RoomManager {
  // Map of roomCode -> Set of ClientConnection
  private rooms: Map<string, Set<ClientConnection>> = new Map();
  // Map of WebSocket -> ClientConnection
  private clients: Map<WebSocket, ClientConnection> = new Map();

  joinRoom(ws: WebSocket, roomCode: string, roomId: string, deviceId?: string) {
    const formattedCode = roomCode.toUpperCase().trim();

    // If client is already in a room, leave it first
    this.leaveRoom(ws);

    const clientConn: ClientConnection = {
      ws,
      deviceId,
      roomCode: formattedCode,
      roomId
    };

    if (!this.rooms.has(formattedCode)) {
      this.rooms.set(formattedCode, new Set());
    }

    this.rooms.get(formattedCode)!.add(clientConn);
    this.clients.set(ws, clientConn);

    return this.getRoomMembersCount(formattedCode);
  }

  leaveRoom(ws: WebSocket) {
    const clientConn = this.clients.get(ws);
    if (!clientConn) return;

    const roomSet = this.rooms.get(clientConn.roomCode);
    if (roomSet) {
      roomSet.delete(clientConn);
      if (roomSet.size === 0) {
        this.rooms.delete(clientConn.roomCode);
      }
    }

    this.clients.delete(ws);
  }

  getClient(ws: WebSocket): ClientConnection | undefined {
    return this.clients.get(ws);
  }

  getRoomMembersCount(roomCode: string): number {
    const formattedCode = roomCode.toUpperCase().trim();
    return this.rooms.get(formattedCode)?.size || 0;
  }

  broadcastToRoom(roomCode: string, message: ServerMessage, senderWs?: WebSocket) {
    const formattedCode = roomCode.toUpperCase().trim();
    const roomSet = this.rooms.get(formattedCode);
    if (!roomSet) return;

    const payload = JSON.stringify(message);

    for (const client of roomSet) {
      // Don't send back to the sender if senderWs is specified
      if (senderWs && client.ws === senderWs) continue;

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

export const roomManager = new RoomManager();
