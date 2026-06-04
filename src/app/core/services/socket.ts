import { Injectable, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '../../data/services/auth';
import { Observable } from 'rxjs';
import { BASE_URL } from '../constants/api';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private authService = inject(AuthService);
  private socket: Socket | null = null;
  private readonly baseUrl = BASE_URL;

  status = signal<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  connect(namespace: string = '') {
    if (this.socket) {
      console.log('Socket already exists, disconnecting before new connection');
      this.disconnect();
    }

    const token = this.authService.getToken();
    const url = namespace ? `${this.baseUrl}${namespace}` : this.baseUrl;
    
    console.log(`Attempting to connect to socket at: ${url}`);
    this.status.set('connecting');

    this.socket = io(url, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log(`✅ Successfully connected to socket namespace: ${namespace || 'root'}`);
      console.log(`📡 Socket ID: ${this.socket?.id}`);
      this.status.set('connected');
    });

    this.socket.on('connect_error', (error) => {
      console.error(`❌ Socket connection error for ${namespace || 'root'}:`, error);
      this.status.set('error');
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`⚠️ Socket disconnected from ${namespace || 'root'}: ${reason}`);
      this.status.set('disconnected');

      // 'io server disconnect' means the server kicked us (e.g. JWT expired).
      // Do NOT try to reconnect with the same stale credentials.
      // The user must re-authenticate first.
      if (reason === 'io server disconnect') {
        console.warn('Server kicked the client (likely JWT expired). Cleaning up socket.');
        this.socket = null;
      }
    });
  }

  fromEvent<T>(eventName: string): Observable<T> {
    return new Observable<T>(observer => {
      const currentSocket = this.socket;

      if (!currentSocket) {
        console.error(`Cannot listen to '${eventName}': socket not initialized. Call connect() first.`);
        return;
      }

      const handler = (data: T) => {
        console.log(`📩 Received socket event: ${eventName}`, data);
        observer.next(data);
      };

      currentSocket.on(eventName, handler);

      return () => {
        currentSocket.off(eventName, handler);
      };
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.status.set('disconnected');
    }
  }
}
