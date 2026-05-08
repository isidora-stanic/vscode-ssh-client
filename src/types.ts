export type AuthType = 'password' | 'privateKey';
export type ConnectionScope = 'global' | 'workspace';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SftpConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  /** Path to private key file, e.g. ~/.ssh/id_rsa */
  privateKeyPath?: string;
  /** Root directory shown in the tree */
  remotePath: string;
  scope: ConnectionScope;
  /** VS Code ThemeColor ID for tab/file decoration, e.g. "terminal.ansiCyan" */
  color?: string;
}

export interface ConnectionState {
  config: SftpConnectionConfig;
  status: ConnectionStatus;
  error?: string;
}
