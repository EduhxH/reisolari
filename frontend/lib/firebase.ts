"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  type Auth
} from "firebase/auth";

// Firebase web configuration is public by design (it identifies the project,
// it is not a secret). Security is enforced by Firebase Auth rules and by
// backend ID-token verification.
const firebaseConfig = {
  apiKey: "AIzaSyBS1j_fiUCNn3yMMT52ZgE494E7x0LcUSg",
  authDomain: "reisolari-92630.firebaseapp.com",
  projectId: "reisolari-92630",
  storageBucket: "reisolari-92630.firebasestorage.app",
  messagingSenderId: "378633960227",
  appId: "1:378633960227:web:18171d0789a46ebd8bea96",
  measurementId: "G-LW8JZWW0PC"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
auth.useDeviceLanguage();

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

export { app };
