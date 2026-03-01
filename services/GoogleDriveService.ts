
import { AppSettings } from './SettingsService';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// Environment variable or Local Storage fallback
let currentClientId = process.env.CLIENT_ID || localStorage.getItem('t_astro_google_client_id') || '';
const API_KEY = process.env.API_KEY || ''; 

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const SETTINGS_FILE_NAME = 't-astro-settings.json';

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;

export const setClientId = (id: string) => {
    currentClientId = id.trim();
    localStorage.setItem('t_astro_google_client_id', currentClientId);
    // Re-init if libraries are ready
    if (window.google && window.google.accounts) {
        try {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: currentClientId,
                scope: SCOPES,
                callback: '', // defined dynamically
            });
            gisInited = true;
        } catch (e) {
            console.error("Failed to re-init token client", e);
        }
    }
};

export const getClientId = () => currentClientId;

export const initGoogleDrive = async (): Promise<void> => {
    return new Promise((resolve) => {
        const checkInit = () => {
            if (window.gapi && window.google) {
                window.gapi.load('client', async () => {
                    await window.gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: DISCOVERY_DOCS,
                    });
                    gapiInited = true;
                    maybeResolve();
                });

                if (currentClientId) {
                    try {
                        tokenClient = window.google.accounts.oauth2.initTokenClient({
                            client_id: currentClientId,
                            scope: SCOPES,
                            callback: '', // defined dynamically
                        });
                        gisInited = true;
                    } catch (e) {
                        console.warn("Token Client Init skipped (likely invalid/empty Client ID)");
                    }
                }
                maybeResolve();
            } else {
                setTimeout(checkInit, 100);
            }
        };
        
        const maybeResolve = () => {
            if (gapiInited) resolve();
        };

        checkInit();
    });
};

const getToken = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            // Try to init one last time if ID was just set
            if (currentClientId && window.google) {
                 tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: currentClientId,
                    scope: SCOPES,
                    callback: '',
                });
            } else {
                reject(new Error("Google Client ID is missing. Please configure it in Settings."));
                return;
            }
        }

        tokenClient.callback = async (resp: any) => {
            if (resp.error !== undefined) {
                reject(resp);
            }
            resolve(resp);
        };
        // Request access token with consent prompt if needed
        tokenClient.requestAccessToken({ prompt: '' });
    });
};

export const signIn = async (): Promise<void> => {
    if (!gapiInited) await initGoogleDrive();
    await getToken();
};

const findConfigFile = async (): Promise<string | null> => {
    try {
        const response = await window.gapi.client.drive.files.list({
            'q': `name = '${SETTINGS_FILE_NAME}' and trashed = false`,
            'fields': 'files(id, name)',
            'spaces': 'drive'
        });
        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0].id;
        }
        return null;
    } catch (e) {
        console.error("Error finding settings file in Drive", e);
        throw e;
    }
};

export const saveSettingsToDrive = async (settings: AppSettings): Promise<void> => {
    if (!gapiInited) await initGoogleDrive();
    
    // Ensure we have a token
    if (!window.gapi.client.getToken()) {
        await getToken();
    }

    const fileContent = JSON.stringify(settings, null, 2);
    
    // Check if file exists
    let fileId = await findConfigFile();

    const fileMetadata = {
        name: SETTINGS_FILE_NAME,
        mimeType: 'application/json',
    };

    const multipartRequestBody =
        `\r\n--foo_bar_baz\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(fileMetadata) +
        `\r\n--foo_bar_baz\r\nContent-Type: application/json\r\n\r\n` +
        fileContent +
        `\r\n--foo_bar_baz--`;

    try {
        if (fileId) {
            // Update existing file
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${window.gapi.client.getToken().access_token}`,
                    'Content-Type': 'multipart/related; boundary=foo_bar_baz',
                },
                body: multipartRequestBody
            });
        } else {
            // Create new file
            await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.gapi.client.getToken().access_token}`,
                    'Content-Type': 'multipart/related; boundary=foo_bar_baz',
                },
                body: multipartRequestBody
            });
        }
    } catch (e) {
        console.error("Error saving to Drive", e);
        throw e;
    }
};

export const loadSettingsFromDrive = async (): Promise<AppSettings> => {
    if (!gapiInited) await initGoogleDrive();
    
    if (!window.gapi.client.getToken()) {
        await getToken();
    }

    const fileId = await findConfigFile();
    if (!fileId) {
        throw new Error("Settings file not found in Google Drive.");
    }

    const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
    });

    // Handle body which can be string or object depending on library version/response
    let result = response.body;
    
    try {
        if (typeof result === 'string') {
            result = JSON.parse(result);
        } else if (response.result) {
            result = response.result;
        }
    } catch (e) {
        throw new Error("Failed to parse settings file from Google Drive.");
    }
    
    return result as AppSettings;
};

export const isDriveSignedIn = (): boolean => {
    return window.gapi && window.gapi.client && !!window.gapi.client.getToken();
};
