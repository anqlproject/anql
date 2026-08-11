import "./MathPanel.css";

import { $getSelection, $isRangeSelection, LexicalEditor } from "lexical";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { MenuPosition } from "@/components/custom/Menu/Menu";
import { useMathVariables } from "@/editor/context/MathVariablesContext";
import { $isMathExpNode } from "@/editor/nodes/MathNode/MathExpNode";
import CustomCaret from "@/editor/plugins/ContextMenuPlugin/CustomCaret";
import { HightlightSelectedText } from "@/editor/plugins/ContextMenuPlugin/HighlightSelectedText";

interface MathPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position: MenuPosition;
  editor: LexicalEditor;
  caretPosition: { x: number; y: number };
  showCaret: boolean;
  caretTimestamp: number;
  selectionRects: DOMRect[];
  activeNodeKey: string | null;
}

interface MathItem {
  label: string;
  insert: string;
}

interface MathCategory {
  name: string;
  items: MathItem[];
  isDynamic?: boolean;
}

const MATH_CATEGORIES: MathCategory[] = [
  {
    name: "variables",
    items: [], // Will be populated dynamically
    isDynamic: true,
  },
  {
    name: "trigonometry",
    items: [
      { label: "sin", insert: "sin()" },
      { label: "cos", insert: "cos()" },
      { label: "tan", insert: "tan()" },
      { label: "asin", insert: "asin()" },
      { label: "acos", insert: "acos()" },
      { label: "atan", insert: "atan()" },
      { label: "atan2", insert: "atan2()" },
      { label: "sinh", insert: "sinh()" },
      { label: "cosh", insert: "cosh()" },
      { label: "tanh", insert: "tanh()" },
    ],
  },
  {
    name: "arithmetic",
    items: [
      { label: "+", insert: "+" },
      { label: "-", insert: "-" },
      { label: "×", insert: "*" },
      { label: "÷", insert: "/" },
      { label: "^", insert: "^" },
      { label: "²", insert: "^2" },
      { label: "³", insert: "^3" },
      { label: "√", insert: "sqrt()" },
      { label: "sqrt", insert: "sqrt()" },
      { label: "abs", insert: "abs()" },
      { label: "mod", insert: "mod" },
      { label: "pow", insert: "pow()" },
      { label: "exp", insert: "exp()" },
      { label: "ceil", insert: "ceil()" },
      { label: "floor", insert: "floor()" },
      { label: "round", insert: "round()" },
      { label: "sign", insert: "sign()" },
    ],
  },
  {
    name: "logarithms",
    items: [
      { label: "log", insert: "log()" },
      { label: "log₂", insert: "log(, 2)" },
      { label: "log₁₀", insert: "log(, 10)" },
    ],
  },
  {
    name: "constants",
    items: [
      { label: "π", insert: "pi" },
      { label: "e", insert: "e" },
      { label: "∞", insert: "Infinity" },
      { label: "i", insert: "i" },
      { label: "phi", insert: "phi" },
    ],
  },
  {
    name: "statistics",
    items: [
      { label: "mean", insert: "mean()" },
      { label: "median", insert: "median()" },
      { label: "std", insert: "std()" },
      { label: "variance", insert: "variance()" },
      { label: "min", insert: "min()" },
      { label: "max", insert: "max()" },
      { label: "sum", insert: "sum()" },
      { label: "prod", insert: "prod()" },
    ],
  },
  {
    name: "algebra",
    items: [
      { label: "derivative", insert: "derivative()" },
      { label: "simplify", insert: "simplify()" },
      { label: "factorial", insert: "factorial()" },
      { label: "gamma", insert: "gamma()" },
      { label: "gcd", insert: "gcd()" },
      { label: "lcm", insert: "lcm()" },
      { label: "fraction", insert: "fraction()" },
      { label: "format", insert: "format()" },
    ],
  },
  {
    name: "matrices",
    items: [
      { label: "det", insert: "det()" },
      { label: "inv", insert: "inv()" },
      { label: "transpose", insert: "transpose()" },
      { label: "dot", insert: "dot()" },
      { label: "cross", insert: "cross()" },
      { label: "eigs", insert: "eigs()" },
      { label: "size", insert: "size()" },
    ],
  },
  {
    name: "comparisons",
    items: [
      { label: "=", insert: "=" },
      { label: "≠", insert: "!=" },
      { label: "<", insert: "<" },
      { label: ">", insert: ">" },
      { label: "≤", insert: "<=" },
      { label: "≥", insert: ">=" },
      { label: "and", insert: "and" },
      { label: "or", insert: "or" },
      { label: "not", insert: "not " },
      { label: "xor", insert: "xor" },
    ],
  },
  {
    name: "random",
    items: [
      { label: "random", insert: "random()" },
      { label: "randomInt", insert: "randomInt()" },
      { label: "pickRandom", insert: "pickRandom()" },
    ],
  },
  {
    name: "geometry",
    items: [
      { label: "distance", insert: "distance()" },
      { label: "intersect", insert: "intersect()" },
    ],
  },
];

export default function MathPanel({
  isOpen,
  onClose,
  position,
  editor,
  caretPosition,
  showCaret,
  caretTimestamp,
  selectionRects,
  activeNodeKey,
}: MathPanelProps) {
  const { t } = useTranslation();
  const { variables, scopes } = useMathVariables();
  const panelRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Update variables category dynamically based on the active node's scope
  const mathCategoriesWithVariables = useMemo(() => {
    // Si on a un node actif et un scope calculé pour lui, on utilise ce scope, sinon on fallback sur toutes les variables (ex: mode dégradé)
    const availableVariables = activeNodeKey && scopes[activeNodeKey] ? scopes[activeNodeKey] : variables;

    return MATH_CATEGORIES.map(category => {
      if (category.isDynamic) {
        const variableItems: MathItem[] = Object.entries(availableVariables).map(([name, value]) => ({
          label: `${name} (${value})`,
          insert: name,
        }));
        return { ...category, items: variableItems };
      }
      return category;
    });
  }, [variables, scopes, activeNodeKey]);

  // Items filtrés lors d'une recherche (vue flat)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const allItems = mathCategoriesWithVariables.flatMap(c => c.items);

    // Filtrage global sans doublons de label
    const seen = new Set();
    return allItems.filter(item => {
      const match = item.label.toLowerCase().includes(query) || item.insert.toLowerCase().includes(query);
      if (match && !seen.has(item.label)) {
        seen.add(item.label);
        return true;
      }
      return false;
    });
  }, [searchQuery, mathCategoriesWithVariables]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fermer au clic extérieur
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, onClose]);

  const insertIntoMathNode = (text: string) => {
    try {
      editor.update(() => {
        // Vérifier que le composant est toujours monté
        if (!isMountedRef.current) {
          return;
        }

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          if (isMountedRef.current) onClose();
          return;
        }

        // Vérifier si on est dans un MathNode
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getType() === 'mathexp' ? anchorNode : anchorNode.getParent();

        if (!$isMathExpNode(element)) {
          // Si on n'est pas dans un MathNode, ne pas insérer
          if (isMountedRef.current) onClose();
          return;
        }

        selection.insertText(text);

        // Si le texte inséré se termine par "()", placer le curseur à l'intérieur des parens
        // ex: "sin()|" → "sin(|)"
        if (text.endsWith('()')) {
          const updatedSelection = $getSelection();
          if ($isRangeSelection(updatedSelection)) {
            const anchor = updatedSelection.anchor;
            const focus = updatedSelection.focus;
            // Reculer d'un caractère (devant la parenthèse fermante)
            const newOffset = Math.max(0, anchor.offset - 1);
            anchor.set(anchor.key, newOffset, anchor.type);
            focus.set(focus.key, newOffset, focus.type);
          }
        }

      });

      if (isMountedRef.current) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to insert text into math node:', error);
      if (isMountedRef.current) {
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Highlight de sélection */}
      <HightlightSelectedText isMenuOpen={isOpen} selectionRects={selectionRects} />

      {/* Caret simple si pas de sélection */}
      {showCaret && (
        <CustomCaret
          position={caretPosition}
          visible={showCaret}
          timestamp={caretTimestamp}
        />
      )}

      {/* Panel avec tabs et catégories */}
      <div
        ref={panelRef}
        className="math-panel"
        style={{ top: position.y, left: position.x }}
      >
        {/* Search Bar */}
        <div className="math-panel__search-container">
          <Search size={14} className="math-panel__search-icon" />
          <input
            type="text"
            className="math-panel__search-input"
            placeholder={t('MATH_PANEL.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            autoFocus
          />
        </div>

        {/* Zone de défilement principale */}
        <div className="math-panel__scroll-area">
          {searchQuery ? (
            /* VUE RECHERCHE : Liste plate des résultats */
            <div className="math-panel__section">
              <div className="math-panel__section-title">
                {t('MATH_PANEL.searchResults')}
              </div>
              <div className="math-panel__content">
                {searchResults.length > 0 ? (
                  searchResults.map(({ label, insert }, index) => (
                    <button
                      key={`${label}-${index}`}
                      className="math-panel__item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertIntoMathNode(insert);
                      }}
                    >
                      {label}
                    </button>
                  ))
                ) : (
                  <div className="math-panel__empty">
                    {t('MATH_PANEL.noResults')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VUE NORMALE : Toutes les catégories listées */
            mathCategoriesWithVariables.map((category) => {
              if (category.items.length === 0 && !category.isDynamic) return null;

              return (
                <div key={category.name} className="math-panel__section">
                  <div className={`math-panel__section-title ${category.isDynamic ? 'math-panel__section-title--variables' : ''}`}>
                    {t(`MATH_PANEL.${category.name}`)}
                  </div>
                  <div className={`math-panel__content ${category.isDynamic ? 'math-panel__content--variables' : ''}`}>
                    {category.items.length > 0 ? (
                      category.items.map(({ label, insert }, index) => (
                        <button
                          key={`${category.name}-${label}-${index}`}
                          className="math-panel__item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertIntoMathNode(insert);
                          }}
                        >
                          {label}
                        </button>
                      ))
                    ) : (
                      <div className="math-panel__empty">
                        {t('MATH_PANEL.noVariables')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
