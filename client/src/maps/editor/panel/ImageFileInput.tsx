import { forwardRef } from 'react';

interface Props {
  onFile: (file: File) => void;
}

const ImageFileInput = forwardRef<HTMLInputElement, Props>(
  function ImageFileInput({ onFile }, ref) {
    return (
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="d-none"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    );
  },
);

export default ImageFileInput;
