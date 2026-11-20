import jwt from "jsonwebtoken";

// Verifies a Firebase Auth ID token on the server without firebase-admin,
// using Google's published signing certificates.
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "cimp-aa1ec";

let certCache: { certs: Record<string, string>; expiresAt: number } | null =
  null;

async function getCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() < certCache.expiresAt) return certCache.certs;

  const res = await fetch(CERTS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not fetch Firebase signing certs");
  const certs = (await res.json()) as Record<string, string>;

  const maxAge = Number(
    /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600,
  );
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

export interface FirebaseIdentity {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<FirebaseIdentity> {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded && typeof decoded === "object" ? decoded.header.kid : undefined;
  if (!kid) throw new Error("Malformed ID token");

  const cert = (await getCerts())[kid];
  if (!cert) throw new Error("Unknown signing key");

  const payload = jwt.verify(idToken, cert, {
    algorithms: ["RS256"],
    audience: FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
  }) as jwt.JwtPayload;

  if (!payload.sub) throw new Error("ID token has no subject");

  return {
    uid: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
  };
}
