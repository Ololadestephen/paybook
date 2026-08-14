"use client";

import { useState } from "react";
import {
  createChallenge,
  createKeystore,
  enrollmentTypedData,
  exportRecovery,
  openCredential,
  presentCredential,
  unwrapSeed,
  type EncryptedKeystore,
  type PaybookCredentialV1,
} from "@paybook/disclosure";
import { loadJson, saveJson } from "@/lib/storage";
import ConnectWallet from "@/components/ConnectWallet";
import { useWallet } from "@/lib/wallet";

export default function MePage() {
  const { address: connected } = useWallet();
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [enrollPreview, setEnrollPreview] = useState("");
  const [credRaw, setCredRaw] = useState("");
  const [opened, setOpened] = useState("");

  function create() {
    if (pass.length < 8) {
      setMsg("Use a passphrase of at least 8 characters.");
      return;
    }
    const ks = createKeystore(pass);
    saveJson("keystore", ks.store);
    saveJson("disclosurePublicKey", ks.disclosurePublicKey);
    setMsg("Keystore created. Download the recovery file. The seed is not in the presentation.");
    const blob = new Blob([exportRecovery(ks.store)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "paybook-recovery.json";
    a.click();
  }

  function previewEnrollment() {
    const disclosurePublicKey = loadJson<string>("disclosurePublicKey", "");
    if (!disclosurePublicKey) {
      setMsg("Create a keystore first.");
      return;
    }
    const td = enrollmentTypedData({
      employeeAddress: connected || "0x0",
      company: "0x0",
      disclosurePublicKey,
      nonce: "0x1",
      expiry: Math.floor(Date.now() / 1000) + 86400,
      helper: process.env.NEXT_PUBLIC_PAYBOOK_HELPER ?? "0x0",
      chainId: process.env.NEXT_PUBLIC_CHAIN_ID ?? "SN_SEPOLIA",
    });
    setEnrollPreview(JSON.stringify({ disclosurePublicKey, typedData: td }, null, 2));
    setMsg("Sign this typed data with Ready. The enrollment object is never posted on-chain.");
  }

  function open() {
    try {
      const store = loadJson<EncryptedKeystore | null>("keystore", null);
      const pub = loadJson<string>("disclosurePublicKey", "");
      if (!store || !pub) throw new Error("no keystore");
      const kp = unwrapSeed(store, pass);
      const cred = JSON.parse(credRaw) as PaybookCredentialV1;
      const claim = openCredential(cred, kp.seed, pub);
      setOpened(JSON.stringify(claim, null, 2));
      const challenge = createChallenge();
      const presentation = presentCredential({
        credential: cred,
        seed: kp.seed,
        disclosurePublicKey: pub,
        verifierChallenge: challenge,
        expiry: Math.floor(Date.now() / 1000) + 600,
      });
      saveJson("lastPresentation", { challenge, presentation });
      setMsg("Credential opened. A verifier-bound presentation is in local storage — it is not your keystore.");
    } catch (e) {
      setMsg(String(e));
    }
  }

  return (
    <main>
      <h1>Employee</h1>
      <p className="lede">
        Random X25519 / Ed25519 keys, wrapped with your passphrase. Wallet signatures
        authenticate. They do not wrap the key.
      </p>
      <p>
        <ConnectWallet />
      </p>
      <div className="grid">
        <div className="card">
          <label>Passphrase</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <p>
            <button type="button" onClick={create}>
              Create keystore + recovery file
            </button>{" "}
            <button className="ghost" type="button" onClick={previewEnrollment}>
              Preview enrollment typed data
            </button>
          </p>
        </div>
        <div className="card">
          <label>Paste PaybookCredentialV1</label>
          <textarea value={credRaw} onChange={(e) => setCredRaw(e.target.value)} className="mono" />
          <button type="button" onClick={open}>
            Open + present
          </button>
        </div>
      </div>
      {msg && <p className="hint">{msg}</p>}
      {enrollPreview && <pre className="card break">{enrollPreview}</pre>}
      {opened && <pre className="card break">{opened}</pre>}
      <p className="hint">
        Unshielding a distinctive amount can link you to the pay. Prefer round
        denominations.
      </p>
    </main>
  );
}
