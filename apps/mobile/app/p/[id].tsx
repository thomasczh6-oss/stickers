import { Redirect, useLocalSearchParams } from "expo-router";

/** https://<site>/p/<id> (universal link / App Link) lands here; show the pack screen. */
export default function WebPackLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/pack/[id]", params: { id } }} />;
}
