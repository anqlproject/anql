import { create } from 'zustand';

import { ConfigSlice, createConfigSlice } from './createConfigSlice';
import { BlocChangesType,createDocumentSlice, DocumentSlice } from './createDocumentSlice';
import { createRefSlice, NodeStateType,RefSlice } from './createRefSlice';
import { createSearchSlice, SearchSlice } from './createSearchSlice';
import { createUISlice, UISlice } from './createUISlice';

export type { BlocChangesType, NodeStateType };

export type GlobalState = DocumentSlice & UISlice & SearchSlice & RefSlice & ConfigSlice;

export const useGlobalStore = create<GlobalState>()((...a) => ({
  ...createDocumentSlice(...a),
  ...createUISlice(...a),
  ...createSearchSlice(...a),
  ...createRefSlice(...a),
  ...createConfigSlice(...a),
}));
