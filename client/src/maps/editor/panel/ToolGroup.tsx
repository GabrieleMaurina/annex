import { useState } from 'react';
import { Button, ButtonGroup, Dropdown } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import type { PaintTool } from '../paint/paintTools';

export interface ToolOption {
  key: PaintTool;
  label: string;
  icon: string;
}

interface Props {
  label: string;
  options: ToolOption[];
  tool: PaintTool | null;
  setTool: (tool: PaintTool | null) => void;
}

function ToolGroup({ label, options, tool, setTool }: Props) {
  const [chosen, setChosen] = useState(options[0]);
  const active = options.find((o) => o.key === tool);
  if (active && active !== chosen) setChosen(active);
  const variant = active ? 'primary' : 'outline-secondary';
  return (
    <Dropdown
      as={ButtonGroup}
      className="w-100"
      onSelect={(key) => {
        const option = options.find((o) => o.key === key);
        if (option) setTool(option.key);
      }}
    >
      <Button
        size="sm"
        variant={variant}
        className="d-flex flex-grow-1 align-items-center justify-content-center gap-1"
        onClick={() => setTool(active ? null : chosen.key)}
      >
        <WhiteIcon path={chosen.icon} />
        {chosen.label}
      </Button>
      <Dropdown.Toggle size="sm" variant={variant} split>
        <span className="visually-hidden">Choose {label}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {options.map((o) => (
          <Dropdown.Item
            key={o.key}
            as="button"
            eventKey={o.key}
            active={tool === o.key}
            className="d-flex align-items-center gap-2"
          >
            <WhiteIcon path={o.icon} />
            {o.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default ToolGroup;
