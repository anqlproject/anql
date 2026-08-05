import React from 'react';
import { StateCreator } from 'zustand';

export interface NodeStateType {
  node_type: string;
  position: string;
  id: string;
  checksum?: string;
}

export interface RefSlice {
  dynamicState: React.MutableRefObject<Map<string, NodeStateType>>;
  
  appRef: React.RefObject<HTMLDivElement | null>;
  editorShellRef: React.RefObject<HTMLDivElement | null>;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  editorRef: React.RefObject<HTMLDivElement | null>;
  sideBarRef: React.RefObject<HTMLDivElement | null>;
  mainContainerRef: React.RefObject<HTMLDivElement | null>;
  overlayMenuContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const createRefSlice: StateCreator<RefSlice> = () => ({
  dynamicState: { current: new Map() },
  appRef: React.createRef<HTMLDivElement>(),
  editorShellRef: React.createRef<HTMLDivElement>(),
  editorContainerRef: React.createRef<HTMLDivElement>(),
  editorRef: React.createRef<HTMLDivElement>(),
  sideBarRef: React.createRef<HTMLDivElement>(),
  mainContainerRef: React.createRef<HTMLDivElement>(),
  overlayMenuContainerRef: React.createRef<HTMLDivElement>(),
});
