export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface PgBinaries {
  pgDump: string;
  pgRestore: string;
  psql: string;
  createdb: string;
  dropdb: string;
  majorVersion: number;
}

export interface AppInstall {
  installDir: string;
  exePath: string | null;
  resourcesPath: string;
  backendDir: string;
  uploadsDir: string;
  migrateScriptPath: string;
  migrationsDir: string;
  installedVersion: string | null;
}

export interface UploadFileEntry {
  relativePath: string;
  sha256: string;
  bytes: number;
}

export interface Manifest {
  createdAt: string;
  databaseName: string;
  appVersionBeforeUpgrade: string | null;
  pg: {
    version: string;
    majorVersion: number;
    encoding: string;
    collate: string;
    ctype: string;
  };
  migrations: {
    appliedCount: number;
    pendingCount: number;
    appliedFiles: string[];
    pendingFiles: string[];
  };
  rowCounts: Record<string, number>;
  uploads: {
    fileCount: number;
    totalBytes: number;
    files: UploadFileEntry[];
  };
  dumps: {
    customDumpFile: string;
    customDumpSha256: string;
    customDumpBytes: number;
    plainDumpFile: string;
    plainDumpSha256: string;
    plainDumpBytes: number;
  };
}

export interface RunState {
  runDir: string;
  createdAt: string;
  dbConfig: {
    host: string;
    port: number;
    user: string;
    database: string;
  };
  steps: {
    preflight?: { completedAt: string };
    backup?: { completedAt: string };
    verifyBackup?: { completedAt: string; verified: boolean; details: string };
    offsiteCopy?: { completedAt: string; dest: string };
    upgrade?: { completedAt: string; installerPath: string; migrateExitCode: number };
    postVerify?: { completedAt: string; passed: boolean; details: string };
    rollback?: { completedAt: string };
  };
}
