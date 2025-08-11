export function extrairAccessToken(cookieString: string) {
  const match = cookieString.match(/(?:^|;\s*)access_token=([^;]+)/);
  return match ? match[1] : null;
}
