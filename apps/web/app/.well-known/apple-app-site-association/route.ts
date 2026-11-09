/** iOS universal links: lets https://<site>/p/<id> open the app when it is installed. */
export function GET() {
  const appId = `${process.env.APPLE_TEAM_ID ?? "TEAMID"}.${process.env.IOS_BUNDLE_ID ?? "ai.stickers.app"}`;
  return Response.json({
    applinks: { details: [{ appIDs: [appId], components: [{ "/": "/p/*", comment: "sticker pack pages" }] }] },
  });
}
