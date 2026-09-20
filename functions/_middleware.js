const REALM = "Pokemart Expo Admin";

export async function onRequest(context) {
  const username = context.env.ADMIN_USERNAME || "admin";
  const password = context.env.ADMIN_PASSWORD;

  if (!password) {
    return new Response("Admin password is not configured.", { status: 500 });
  }

  const credentials = parseBasicAuth(context.request.headers.get("Authorization"));
  if (!credentials || credentials.username !== username || credentials.password !== password) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`
      }
    });
  }

  return context.next();
}

function parseBasicAuth(header) {
  if (!header || !header.startsWith("Basic ")) {
    return null;
  }

  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1)
  };
}
