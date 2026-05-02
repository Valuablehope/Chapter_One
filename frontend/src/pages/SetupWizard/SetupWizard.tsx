import { useState } from 'react';
import { Server, Monitor, Shield, Building2, HardDrive, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';

type SetupMode = 'server' | 'terminal' | null;

export default function SetupWizard() {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<SetupMode>(null);
  const [serverIp, setServerIp] = useState('');
  const [storeName, setStoreName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [port, setPort] = useState('5432');
  const [dbUser, setDbUser] = useState('postgres');
  const [dbPassword, setDbPassword] = useState('');
  const [dbName, setDbName] = useState('Chapter_One');
  
  const [isInstalling, setIsInstalling] = useState(false);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [installError, setInstallError] = useState<string | null>(null);

  const addLog = (log: string) => setInstallLogs((prev) => [...prev, log]);

  const handleInstall = async () => {
    setIsInstalling(true);
    setInstallError(null);
    setStep(3); // Progress screen

    try {
      if (mode === 'server') {
        addLog('Starting PostgreSQL installation...');
        const pgRes = await window.electronAPI.setupInstallPostgres({ password: adminPassword, port });
        if (!pgRes.success) throw new Error(pgRes.error || 'Failed to install PostgreSQL');
        addLog('✅ PostgreSQL installed successfully.');

        addLog('Running database migrations...');
        const migrationRes = await window.electronAPI.setupRunMigrations({ password: adminPassword, port });
        if (!migrationRes.success) throw new Error(migrationRes.error || 'Failed to run migrations');
        addLog('✅ Database ready.');

        addLog('Creating default administrator account...');
        const adminRes = await window.electronAPI.setupCreateAdmin({ password: adminPassword, port });
        if (!adminRes.success) addLog('⚠️ Warning: Could not create admin account automatically.');
        else addLog('✅ Administrator account created.');

        addLog(`Initializing store: ${storeName}...`);
        const storeRes = await window.electronAPI.setupInitializeStore({ storeName, password: adminPassword, port });
        if (!storeRes.success) addLog('⚠️ Warning: Could not initialize store name automatically.');
        else addLog('✅ Store initialized.');

        addLog('Configuring Windows Service...');
        const serviceRes = await window.electronAPI.setupInstallService();
        if (!serviceRes.success) throw new Error(serviceRes.error || 'Failed to install service');
        addLog('✅ Background service registered.');

        addLog('Saving server configuration...');
        const encodedPassword = encodeURIComponent(adminPassword);
        const saveRes = await window.electronAPI.setupSaveConfig({
          DATABASE_URL: `postgres://postgres:${encodedPassword}@localhost:${port}/Chapter_One`,
          STORE_NAME: storeName,
          ADMIN_PASSWORD: adminPassword,
        });
        if (!saveRes.success) throw new Error(saveRes.error || 'Failed to save config');
        addLog('✅ Configuration saved.');

      } else {
        addLog('Saving terminal configuration...');
        const encodedPassword = encodeURIComponent(dbPassword);
        const saveRes = await window.electronAPI.setupSaveConfig({
          DB_HOST: serverIp,
          DB_PORT: port,
          DB_USER: dbUser,
          DB_PASSWORD: dbPassword,
          DB_NAME: dbName,
          DATABASE_URL: `postgres://${dbUser}:${encodedPassword}@${serverIp}:${port}/${dbName}`,
          STORE_NAME: storeName,
        });
        if (!saveRes.success) throw new Error(saveRes.error || 'Failed to save config');
        addLog('✅ Configuration saved.');
      }

      setStep(4); // Success screen
    } catch (err: any) {
      setInstallError(err.message || 'An unknown error occurred');
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const finishSetup = async () => {
    await window.electronAPI.setupComplete();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[600px]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Chapter One Setup</h1>
            <p className="text-slate-400 mt-1">First-run configuration wizard</p>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s} 
                className={`w-3 h-3 rounded-full ${s === step ? 'bg-indigo-500' : s < step ? 'bg-emerald-500' : 'bg-slate-700'}`}
              />
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-8 overflow-y-auto">
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-semibold mb-6 text-gray-800 text-center">How will this machine be used?</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <button 
                  onClick={() => setMode('server')}
                  className={`p-6 border-2 rounded-xl text-left transition-all duration-200 group ${mode === 'server' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}
                >
                  <Server className={`w-12 h-12 mb-4 ${mode === 'server' ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-400'}`} />
                  <h3 className="text-lg font-bold text-gray-900">Main Server</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Select this if this machine hosts the database. It will install PostgreSQL and run background services.
                  </p>
                </button>

                <button 
                  onClick={() => setMode('terminal')}
                  className={`p-6 border-2 rounded-xl text-left transition-all duration-200 group ${mode === 'terminal' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}
                >
                  <Monitor className={`w-12 h-12 mb-4 ${mode === 'terminal' ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-400'}`} />
                  <h3 className="text-lg font-bold text-gray-900">POS Terminal</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Select this if this machine connects to an existing server over the local network.
                  </p>
                </button>
              </div>

              <div className="mt-12 flex justify-end">
                <button
                  disabled={!mode}
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                >
                  Continue <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in max-w-xl mx-auto">
              <h2 className="text-xl font-semibold mb-6 text-gray-800">
                {mode === 'server' ? 'Server Configuration' : 'Terminal Configuration'}
              </h2>
              
              <div className="space-y-5">
                {mode === 'terminal' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    <p className="font-semibold mb-2">⚠️ Before proceeding, ensure the main server has:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                      <li>PostgreSQL configured to accept remote connections (<code className="bg-blue-100 px-1 rounded">listen_addresses = '*'</code> in postgresql.conf)</li>
                      <li>A firewall rule allowing TCP on the database port from this terminal's IP</li>
                      <li>An entry in <code className="bg-blue-100 px-1 rounded">pg_hba.conf</code> allowing this terminal's IP to connect (e.g. <code className="bg-blue-100 px-1 rounded">host all all 192.168.1.0/24 md5</code>)</li>
                    </ul>
                  </div>
                )}
                {mode === 'terminal' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <HardDrive className="w-4 h-4 mr-2" /> Server IP Address
                    </label>
                    <input
                      type="text"
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                      placeholder="e.g. 192.168.1.100"
                      value={serverIp}
                      onChange={(e) => setServerIp(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <Building2 className="w-4 h-4 mr-2" /> Store Name
                  </label>
                  <input
                    type="text"
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                    placeholder="Chapter One Store"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Database Port</label>
                  <input
                    type="text"
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                    placeholder="5432"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>

                {mode === 'terminal' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Database Username</label>
                        <input
                          type="text"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                          placeholder="postgres"
                          value={dbUser}
                          onChange={(e) => setDbUser(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Database Name</label>
                        <input
                          type="text"
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                          placeholder="Chapter_One"
                          value={dbName}
                          onChange={(e) => setDbName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <Shield className="w-4 h-4 mr-2" /> Database Password
                      </label>
                      <input
                        type="password"
                        className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                        placeholder="PostgreSQL password on the server"
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">This is the PostgreSQL password configured on the main server.</p>
                    </div>
                  </>
                )}

                {mode === 'server' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Shield className="w-4 h-4 mr-2" /> Admin Password
                    </label>
                    <input
                      type="password"
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                      placeholder="Setup master admin password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="mt-10 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Back
                </button>
                <button
                  disabled={(mode === 'terminal' && (!serverIp || !dbPassword)) || (mode === 'server' && !adminPassword) || !storeName}
                  onClick={handleInstall}
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center transition-colors"
                >
                  Begin Installation
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in max-w-xl mx-auto flex flex-col h-full">
              <div className="text-center mb-8">
                {isInstalling ? (
                  <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mx-auto mb-4" />
                ) : installError ? (
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">!</span>
                  </div>
                ) : null}
                <h2 className="text-xl font-semibold text-gray-800">
                  {isInstalling ? 'Configuring System...' : installError ? 'Installation Failed' : 'Completing...'}
                </h2>
                <p className="text-gray-500 mt-2">
                  Please wait while we set up the {mode} environment.
                </p>
              </div>

              <div className="flex-1 bg-gray-900 rounded-xl p-4 overflow-y-auto font-mono text-sm text-green-400 border border-gray-700 shadow-inner">
                {installLogs.map((log, i) => (
                  <div key={i} className="mb-1">{'>'} {log}</div>
                ))}
                {isInstalling && (
                  <div className="animate-pulse">{'>'} _</div>
                )}
              </div>

              {installError && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => {
                      setStep(2);
                      setInstallLogs([]);
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Go Back and Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in text-center flex flex-col items-center justify-center h-full">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Setup Complete!</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Chapter One has been successfully configured as a {mode}. The application will now restart to apply the settings.
              </p>
              <button
                onClick={finishSetup}
                className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                Launch Application
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
