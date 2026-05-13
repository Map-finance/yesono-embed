import { useState, useCallback } from "react";

interface UseImageUploadOptions {
  maxSize?: number; // 最大文件大小（字节）
  acceptedFormats?: string[]; // 接受的文件格式
  onUpload?: (file: File) => Promise<string>; // 上传处理函数，返回URL
}

interface UseImageUploadReturn {
  preview: string | null;
  isUploading: boolean;
  error: string | null;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDrop: (event: React.DragEvent) => Promise<void>;
  clearImage: () => void;
  uploadedUrl: string | null;
}

export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadReturn {
  const {
    maxSize = 200 * 1024, // 默认200KB
    acceptedFormats = ["image/jpeg", "image/png", "image/gif", "image/webp"],
    onUpload,
  } = options;

  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!acceptedFormats.includes(file.type)) {
        return `Invalid file format. Accepted formats: ${acceptedFormats.join(", ")}`;
      }

      if (file.size > maxSize) {
        return `File size exceeds ${Math.round(maxSize / 1024)}KB`;
      }

      return null;
    },
    [maxSize, acceptedFormats]
  );

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      // 创建预览
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // 上传文件
      if (onUpload) {
        setIsUploading(true);
        try {
          const url = await onUpload(file);
          setUploadedUrl(url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
          setPreview(null);
        } finally {
          setIsUploading(false);
        }
      }
    },
    [validateFile, onUpload]
  );

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        await processFile(file);
      }
    },
    [processFile]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const file = event.dataTransfer.files[0];
      if (file) {
        await processFile(file);
      }
    },
    [processFile]
  );

  const clearImage = useCallback(() => {
    setPreview(null);
    setUploadedUrl(null);
    setError(null);
  }, []);

  return {
    preview,
    isUploading,
    error,
    handleFileSelect,
    handleDrop,
    clearImage,
    uploadedUrl,
  };
}
