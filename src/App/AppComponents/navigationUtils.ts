
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from "@/App/store/useGlobalStore";
import { useNavigationStore } from "@/GlobalState/navigationStore";

export function useClearPage() {
  const { dynamicState, setModified, setCurrentDocument } = useGlobalStore(useShallow((state) => ({ dynamicState: state.dynamicState, setModified: state.setModified, setCurrentDocument: state.setCurrentDocument })));

  const emptyChanges = { key: "", type: "", id: "" };
  const emptyDocumentJson = {
    id: "",
    title: "",
    path: "",
    workspace_id: "",
    created_at: 0,
    updated_at: 0,
    tags: "",
  };

  const clearPage = () => {
    dynamicState.current.clear();
    setModified(emptyChanges);
    setCurrentDocument(emptyDocumentJson);
  };

  return clearPage;
}

export function navigationUtils() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const clearPage = useClearPage();

  const goHome = () => {
    navigateTo('home');
    clearPage();
  }

  return {
    goHome
  }
}