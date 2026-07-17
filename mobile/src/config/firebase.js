import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const googleServices = require('../../google-services.json');

const androidClient = googleServices.client?.[0];
const webClient = androidClient?.oauth_client?.find((client) => client.client_type === 3);

export const firebaseWebClientId = webClient?.client_id;

const firebaseConfig = {
  apiKey: androidClient?.api_key?.[0]?.current_key,
  appId: androidClient?.client_info?.mobilesdk_app_id,
  projectId: googleServices.project_info?.project_id,
  authDomain: `${googleServices.project_info?.project_id}.firebaseapp.com`,
  storageBucket: googleServices.project_info?.storage_bucket,
  messagingSenderId: googleServices.project_info?.project_number,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
