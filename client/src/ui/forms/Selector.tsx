import type {
  CSSProperties,
  KeyboardEvent,
  OptionHTMLAttributes,
  ReactElement,
  ReactNode,
} from 'react';
import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import { Dropdown } from 'react-bootstrap';

const TYPE_AHEAD_RESET = 600;
const SELECTOR_POPPER_CONFIG = { strategy: 'fixed' as const };

interface Option {
  value: string;
  label: ReactNode;
  disabled: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  size?: 'sm';
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children)
    .filter(
      (child): child is ReactElement<OptionHTMLAttributes<HTMLOptionElement>> =>
        isValidElement(child) && child.type === 'option',
    )
    .map(({ props }) => ({
      value: String(props.value),
      label: props.children,
      disabled: !!props.disabled,
    }));
}

function labelText(label: ReactNode): string {
  return Children.toArray(label)
    .filter((part) => typeof part === 'string' || typeof part === 'number')
    .join('')
    .toLowerCase();
}

function Selector({
  value,
  onChange,
  children,
  size,
  disabled,
  className = '',
  style,
  'aria-label': ariaLabel,
}: Props) {
  const options = readOptions(children);
  const selected = options.find((o) => o.value === value);
  const [show, setShow] = useState(false);
  const [menuWidth, setMenuWidth] = useState(0);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });

  useEffect(() => {
    const menu = menuRef.current;
    const item = menu?.querySelector<HTMLElement>('[data-selected]');
    if (!show || !menu || !item) return;
    menu.scrollTop =
      item.offsetTop - (menu.clientHeight - item.offsetHeight) / 2;
    item.focus({ preventScroll: true });
  }, [show]);

  function toggle(next: boolean) {
    if (next) setMenuWidth(toggleRef.current?.offsetWidth ?? 0);
    setShow(next);
  }

  function select(key: string | null) {
    if (key !== null && key !== value) onChange(key);
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') e.preventDefault();
    if (e.key.length !== 1 || e.key === ' ' || e.ctrlKey || e.metaKey) return;
    const text =
      (e.timeStamp - typed.current.at > TYPE_AHEAD_RESET
        ? ''
        : typed.current.text) + e.key.toLowerCase();
    typed.current = { text, at: e.timeStamp };
    const index = options.findIndex(
      (o) => !o.disabled && labelText(o.label).startsWith(text),
    );
    if (index < 0) return;
    menuRef.current
      ?.querySelectorAll<HTMLElement>('.selector-option')
      [index]?.focus();
  }

  return (
    <Dropdown
      className="selector"
      show={show}
      onToggle={toggle}
      onSelect={select}
    >
      <Dropdown.Toggle
        ref={toggleRef}
        as="button"
        type="button"
        bsPrefix="selector-toggle"
        className={`${size === 'sm' ? 'selector-toggle-sm' : ''} ${className}`}
        style={style}
        disabled={disabled}
      >
        {ariaLabel && <span className="visually-hidden">{ariaLabel}</span>}
        <span className="text-truncate">{selected?.label}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu
        ref={menuRef}
        className="selector-menu"
        style={{ minWidth: menuWidth }}
        popperConfig={SELECTOR_POPPER_CONFIG}
        onKeyDown={onMenuKeyDown}
      >
        {options.map((option, index) => (
          <Dropdown.Item
            key={option.value}
            as="button"
            type="button"
            eventKey={option.value}
            tabIndex={-1}
            disabled={option.disabled}
            className="selector-option"
            style={{ '--selector-row': index } as CSSProperties}
            data-selected={option.value === value || undefined}
            onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
          >
            <span className="text-truncate">{option.label}</span>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default Selector;
