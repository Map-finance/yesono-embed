"use client";
import { ImageUp, X, Loader2 } from "lucide-react";
import ProxyImage from "@/components/common/ProxyImage";
import { useState, useRef, useEffect } from "react";
import { useImageUpload } from "@/lib/hooks/useImageUpload";
import { uploadFile } from "@/lib/api";
import { useCategories } from "@/lib/services/marketService";
import { useTranslation } from "@/lib/i18n";

interface MarketConfigProps {
  onNext: (data: { category: string; image: string | null }) => void;
  initialData?: {
    category?: string;
    image?: string | null;
  };
}

export default function MarketConfig({
  onNext,
  initialData = {},
}: MarketConfigProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    initialData.category
  );
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  // 从API获取分类列表
  const { categories, isLoading: categoriesLoading } = useCategories();

  const {
    preview,
    isUploading,
    error: uploadError,
    handleFileSelect,
    handleDrop,
    clearImage,
    uploadedUrl,
  } = useImageUpload({
    maxSize: 200 * 1024,
    onUpload: async (file) => {
      const response = await uploadFile(file);
      if (response.success && response.data?.url) {
        return response.data.url;
      }
      throw new Error((response as { msg?: string }).msg || "Upload failed");
    },
  });

  useEffect(() => {
    if (initialData.image) {
      // 如果有初始图片URL，可以在这里设置
    }
  }, [initialData.image]);

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      return;
    }

    setIsLoading(true);
    try {
      // 这里可以执行额外的异步验证
      await new Promise((resolve) => setTimeout(resolve, 500));

      onNext({
        category: selectedCategory,
        image: uploadedUrl || preview,
      });
    } catch (error) {
      console.error("Submission failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = selectedCategory;

  return (
    <div>
      <div className="flex gap-6 text-xs max-md:flex-col max-md:gap-4">
        <div className="flex-1">
          <div>
            <div className="mb-3 text-[var(--text-secondary)]">
              {t.market.create.category}
            </div>
            <div className="grid grid-cols-4 gap-2 max-md:grid-cols-3">
              {categoriesLoading ? (
                <div className="col-span-4 flex items-center gap-2 text-[var(--text-secondary)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.market.create.loadingCategories}</span>
                </div>
              ) : (
                categories.map((cat) => {
                  const isSelected = selectedCategory === cat.slug;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => selectCategory(cat.slug)}
                      disabled={isLoading}
                      className={`w-full border border-solid py-2 px-2 text-xs rounded-lg transition-colors disabled:opacity-50 text-center truncate ${
                        isSelected
                          ? "bg-(--accent) text-black border-(--accent)"
                          : "border-(--border) hover:bg-(--accent) hover:text-black"
                      }`}
                      title={cat.label}
                    >
                      {cat.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-2 text-[var(--text-secondary)] flex justify-between">
            <div>{t.market.create.marketImage}</div>
            <div>{t.market.create.maxSize}</div>
          </div>
          <div
            className="size-52 bg-(--bg-secondary) rounded-md flex items-center justify-center relative overflow-hidden cursor-pointer border-2 border-dashed border-(--border) hover:border-(--accent) transition-colors max-md:w-full max-md:h-40"
            onClick={handleImageClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isLoading || isUploading}
            />
            {preview ? (
              <>
                <ProxyImage
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearImage();
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-(--text-secondary)">
                <ImageUp size={30} />
                <div className="text-xs text-center">
                  {isUploading
                    ? t.market.create.uploading
                    : t.market.create.clickOrDragToUpload}
                </div>
              </div>
            )}
          </div>
          {uploadError && (
            <div className="text-xs text-red-500 mt-2">{uploadError}</div>
          )}
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading || isUploading}
          className="px-4 py-2 rounded-full bg-[var(--accent)] text-sm text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity max-md:w-full"
        >
          {isLoading ? t.market.common.processing : t.market.common.next}
        </button>
      </div>
    </div>
  );
}
