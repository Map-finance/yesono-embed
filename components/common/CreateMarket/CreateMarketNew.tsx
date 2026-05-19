"use client";

/**
 * CreateMarketNew - 新版创建市场组件
 * 基于 API_MARKET.md 接口文档实现
 *
 * 流程:
 * Sports 流程:
 * 1. 选择分类 (GET /api/market/category)
 * 2. 选择候选事件 (GET /api/market/candidate)
 * 3. 配置市场参数 (subType, marketValue, outcomes)
 * 4. 确认并创建 (POST /api/market)
 *
 * General 流程 (非 Sports):
 * 1. 选择分类 + 上传图片
 * 2. 输入市场问题
 * 3. AI生成详情 (标题、描述、结束日期、规则)
 * 4. 预览确认
 * 5. 创建市场
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/shadcn/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import { Combobox, MultiCombobox } from "@/components/ui/shadcn/combobox";
import dayjs from "dayjs";
import { Dialog } from "@/components/ui/Dialog";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Users,
  Loader2,
  Check,
  Clock,
  X,
  Upload,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  Tag,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  TagResp,
  CandidateResp,
  CandidateDetailResp,
  MarketSubType,
  MarketOutcomeReq,
  CreateMarketReqV2,
  CreateMarketRespV2,
  ReviewSportsMarketReq,
  ReviewSportsMarketResp,
  getSubTypeOptions,
  getDefaultOutcomes,
  requiresMarketValue,
} from "@/types/market";
import {
  useCategories,
  useCandidates,
  getCandidateDetail,
  reviewSportsMarket,
  createMarketV2,
  confirmMarket,
  confirmMarkets,
  getCryptoCoins,
  getCryptoExchanges,
  CryptoCoin,
  CryptoExchange,
  createCryptoMarket,
  getCreatedCryptoEvents,
  CreatedCryptoEvent,
  getEventMarkets,
  EventMarketItem,
} from "@/lib/services/marketService";
import {
  aiSupplementMarket,
  aiReviewMarket,
  createGeneralMarket,
  timestampToDateString,
  dateStringToTimestamp,
  formatDate,
  eventSupplement,
  eventMarketSupplement,
  eventReview,
  getMarketTags,
  createGeneralMarketV2,
  type EventSupplementResponse,
  type MarketSupplementResultItem,
  type EventReviewResponse,
  type TagItem,
  createReviewRecord,
  updateReviewRecord,
  markReviewRecordUsed,
} from "@/lib/services/aiService";
import { getEventBySlug, searchEvents, getTagTree, getEvents } from "@/lib/services/homeService";
import { TagTreeNode, EventSummary } from "@/types/home";
import { useMarketInitialize, ENABLE_BATCH_INITIALIZE_CUSTOM } from "@/lib/hooks/useMarketInitialize";
import { useMarketCreationCost } from "@/lib/hooks/useMarketCreationCost";
import { useHybridSmartAccount } from "@/lib/hybrid-auth";
import { useAuthStore } from "@/lib/stores/authStore";
import { useToast } from "@/components/ui/Toast";
import {
  uploadFile,
  reviewMarketImage,
  createSportsMarkets,
  getGameplayOracle,
  getCandidateCreatedMarkets,
  MarketBatchCreateResp,
  MarketBatchFailedItemResp,
  MarketBatchItemResp,
  CandidateMarketItemResp,
} from "@/lib/api";
import { trackEvent } from "@/lib/sentryClient";
import { buildSportsEventUrl } from "@/lib/utils/sportsNav";
import {
  SportsMarketConfigurator,
  SportsMarketConfig,
  MoneylineTeam,
} from "./SportsMarketConfigurator";
// To-B 控制器：UMA 市场创建（替换原先的 createMarketV2 / createCryptoMarket /
// createSportsMarkets + confirmMarkets + batchInitializeMarkets 三步链路，
// 由后端在新通道里一次性完成创建 + 链上初始化）
import { tobApi } from "@/lib/services/tob";
import type { TobUmaMarketCreateReq } from "@/lib/services/tob";
// 工具函数 / 类型 / 常量已拆分至 CreateMarketNew.helpers.ts
import {
  toHex,
  getDefaultCreateBetAmount,
  newBetId,
  normalizeTimestampValue,
  formatTimestampDateOnly,
  normalizeSportsLineValue,
  normalizeSportsOptionValue,
  isDeployedMarket,
  type Step,
  type CryptoMarketType,
  type CryptoTimeType,
  type BatchMarketItem,
  type CreateMarketInitialData,
  type CreateMarketNewProps,
  type CreateFlowResult,
} from "./CreateMarketNew.helpers";

// 重导出公开类型，保持原有 import 路径兼容
export type { CreateMarketInitialData };

export default function CreateMarketNew({
  open = false,
  onOpenChange,
  initialData,
}: CreateMarketNewProps) {
  const router = useRouter();

  // 步骤状态
  const [step, setStep] = useState<Step>("category");

  // 选中的数据
  const [selectedCategory, setSelectedCategory] = useState<TagResp | null>(
    null
  );
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateResp | null>(null);
  const [candidateDetail, setCandidateDetail] =
    useState<CandidateDetailResp | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  // 赛事列表滚动加载哨兵
  const candidateListSentinelRef = useRef<HTMLDivElement>(null);

  // 市场配置
  const [subType, setSubType] = useState<MarketSubType>("moneyline");
  const [marketValue, setMarketValue] = useState<string>("");
  const [totalsLines, setTotalsLines] = useState<string[]>([""]);
  const [spreadLines, setSpreadLines] = useState<string[]>([""]);
  const [question, setQuestion] = useState("");
  const [groupItemTitle, setGroupItemTitle] = useState("");
  const [outcomes, setOutcomes] = useState<MarketOutcomeReq[]>([]);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");
  const [sportsConfig, setSportsConfig] = useState<SportsMarketConfig | null>(
    null
  );
  const [existingSportsMarkets, setExistingSportsMarkets] = useState<CandidateMarketItemResp[]>([]);
  const [isLoadingExistingSportsMarkets, setIsLoadingExistingSportsMarkets] = useState(false);

  // API Hooks
  const { categories, isLoading: isLoadingCategories } = useCategories();
  const {
    candidates,
    isLoading: isLoadingCandidates,
    search: searchCandidates,
    hasMore,
    loadMore,
    filterBySlug,
    filterByDateRange,
  } = useCandidates({ limit: 10 });

  // 链上交易 Hook
  const {
    initializeMarket,
    batchInitializeMarkets,
    isLoading: isInitializing,
    status: initStatus,
  } = useMarketInitialize();
  const { smartAccount } = useHybridSmartAccount();
  const { user: backendUser } = useAuthStore();
  const smartAccountAddress = smartAccount?.address as
    | `0x${string}`
    | undefined;
  const toast = useToast();
  const { t } = useTranslation();
  const { ensureMarketCreationBalance } = useMarketCreationCost();

  // 新版创建流程状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateFlowResult | null>(null);
  const [processingStep, setProcessingStep] = useState<string>("");

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("");

  // 日期范围筛选
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");

  // ============== Crypto 表单状态 ==============
  const [cryptoCoinsData, setCryptoCoinsData] = useState<CryptoCoin[]>([]);
  const [cryptoExchangesData, setCryptoExchangesData] = useState<CryptoExchange[]>([]);
  const [cryptoCoinsLoading, setCryptoCoinsLoading] = useState(false);
  const [coinSearchQuery, setCoinSearchQuery] = useState("");
  const coinSearchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [cryptoMarketType, setCryptoMarketType] = useState<CryptoMarketType>("above");
  const [cryptoCoin, setCryptoCoin] = useState("");
  const [cryptoDate, setCryptoDate] = useState("");
  const [cryptoExchange, setCryptoExchange] = useState("");
  const [cryptoTimeType, setCryptoTimeType] = useState<CryptoTimeType>("daily");
  // Above / Below: 多个目标价格
  const [cryptoTargetPrices, setCryptoTargetPrices] = useState<string[]>([""]);
  // Price Range: 多个区间
  const [cryptoRanges, setCryptoRanges] = useState<Array<{ low: string; high: string; direction: "above" | "below" | "range" }>>([{ low: "", high: "", direction: "range" }]);
  // Hit Price
  const [cryptoHitTargets, setCryptoHitTargets] = useState<string[]>([""]);
  const [cryptoFirstToHits, setCryptoFirstToHits] = useState<Array<{ priceA: string; priceB: string }>>([{ priceA: "", priceB: "" }]);

  // crypto_select_event 步骤：已存在事件选择状态
  const [selectedCryptoEvent, setSelectedCryptoEvent] = useState<CreatedCryptoEvent | null>(null);
  const [cryptoEventSearchQuery, setCryptoEventSearchQuery] = useState("");
  const [cryptoEventResults, setCryptoEventResults] = useState<CreatedCryptoEvent[]>([]);
  const [isSearchingCryptoEvents, setIsSearchingCryptoEvents] = useState(false);
  const cryptoEventSearchTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 已选 crypto event 下的已有市场
  const [cryptoEventExistingMarkets, setCryptoEventExistingMarkets] = useState<EventMarketItem[]>([]);
  const [isLoadingCryptoEventMarkets, setIsLoadingCryptoEventMarkets] = useState(false);
  const [cryptoExistingMarketsCollapsed, setCryptoExistingMarketsCollapsed] = useState(true);

  // crypto_form / crypto_select_event 打开时加载币种和交易所数据
  useEffect(() => {
    if (step !== "crypto_form" && step !== "crypto_select_event") return;
    // 加载交易所列表（一次性）
    // getCryptoExchanges({ limit: 20 })
    //   .then((data) => { if (data.length > 0) setCryptoExchangesData(data); })
    //   .catch((err) => {
    //     console.error("Failed to fetch crypto exchanges:", err);
    //   });
    // 加载默认币种列表
    setCryptoCoinsLoading(true);
    getCryptoCoins({ limit: 50 })
      .then((data) => { if (data.length > 0) setCryptoCoinsData(data); })
      .catch((err) => {
        console.error("Failed to fetch crypto coins:", err);
      })
      .finally(() => setCryptoCoinsLoading(false));
  }, [step]);

  // crypto_select_event 步骤：打开时加载已有事件列表
  useEffect(() => {
    if (step !== "crypto_select_event") return;
    setIsSearchingCryptoEvents(true);
    getCreatedCryptoEvents({ limit: 20 })
      .then((results) => setCryptoEventResults(results))
      .catch((err) => console.error("Failed to fetch crypto events:", err))
      .finally(() => setIsSearchingCryptoEvents(false));
  }, [step]);

  // coin 搜索 debounce
  const handleCoinSearch = useCallback((query: string) => {
    setCoinSearchQuery(query);
    if (coinSearchTimerRef.current) clearTimeout(coinSearchTimerRef.current);
    coinSearchTimerRef.current = setTimeout(async () => {
      setCryptoCoinsLoading(true);
      try {
        const data = await getCryptoCoins({ search: query || undefined, limit: 50 });
        if (data.length > 0) setCryptoCoinsData(data);
      } catch (err) {
        console.error("Failed to fetch crypto coins:", err);
      }
      finally { setCryptoCoinsLoading(false); }
    }, 400);
  }, []);

  // crypto event 搜索 debounce
  const handleCryptoEventSearch = useCallback((query: string) => {
    setCryptoEventSearchQuery(query);
    if (cryptoEventSearchTimerRef.current) clearTimeout(cryptoEventSearchTimerRef.current);
    cryptoEventSearchTimerRef.current = setTimeout(async () => {
      setIsSearchingCryptoEvents(true);
      try {
        const results = await getCreatedCryptoEvents({ searchText: query || undefined, limit: 20 });
        setCryptoEventResults(results);
      } catch (err) {
        console.error("Failed to search crypto events:", err);
      } finally {
        setIsSearchingCryptoEvents(false);
      }
    }, 400);
  }, []);

  // crypto event 选择处理：回填表单字段（市场类型/日期/币种）并加载已有市场
  const handleSelectCryptoEvent = useCallback((event: CreatedCryptoEvent) => {
    setSelectedCryptoEvent(event);
    setCryptoExistingMarketsCollapsed(true);
    // eventType → cryptoMarketType 映射
    const typeMap: Record<string, CryptoMarketType> = {
      ABOVE: "above", BELOW: "below",
      PRICE_RANGE: "price-range",
      HIT_PRICE: "hit-price", FIRST_TO_HIT: "first-to-hit",
    };
    const marketType = typeMap[event.eventType] || "above";
    setCryptoMarketType(marketType);
    // commonResolutionDate（毫秒时间戳）→ YYYY-MM-DD
    const dateStr = formatTimestampDateOnly(event.commonResolutionDate);
    if (dateStr) {
      setCryptoDate(dateStr);
    }
    // coinSymbol 优先，其次按 id 从已加载列表匹配
    if (event.coinSymbol) {
      setCryptoCoin(event.coinSymbol);
    } else {
      const coin = cryptoCoinsData.find((c) => c.id != null && String(c.id) === String(event.coinId));
      if (coin) setCryptoCoin(coin.symbol);
    }
    // 清空价格字段
    setCryptoTargetPrices([""]);
    setCryptoRanges([{ low: "", high: "", direction: "range" }]);
    setCryptoHitTargets([""]);
    setCryptoFirstToHits([{ priceA: "", priceB: "" }]);
    // 加载已有市场
    setCryptoEventExistingMarkets([]);
    setIsLoadingCryptoEventMarkets(true);
    getEventMarkets(event.eventId)
      .then((markets) => setCryptoEventExistingMarkets(markets))
      .catch((err) => console.error("Failed to fetch crypto event markets:", err))
      .finally(() => setIsLoadingCryptoEventMarkets(false));
  }, [cryptoCoinsData]);

  // 搜索节流：500ms debounce（仅在 candidate 步骤时执行）
  useEffect(() => {
    if (step !== "candidate") return;
    const timer = setTimeout(() => {
      searchCandidates(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCandidates, step]);

  // 赛事列表无限滚动：哨兵进入视口时自动 loadMore
  useEffect(() => {
    const sentinel = candidateListSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingCandidates) {
          loadMore();
        }
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingCandidates, loadMore]);

  // ============== 回填数据：从「重新创建」场景传入 ==============
  useEffect(() => {
    if (!open || !initialData) return;
    const cat = initialData.category?.toLowerCase() || "";

    // 根据 category 决定进入哪个流程并回填字段
    if (cat === "crypto") {
      setStep("crypto_form");
      if (initialData.question) setMarketQuestion(initialData.question);
      if (initialData.image || initialData.icon) setMarketImage(initialData.image || initialData.icon || "");
      if (initialData.endDate) setCryptoDate(initialData.endDate);
      if (initialData.cryptoMarketType) setCryptoMarketType(initialData.cryptoMarketType as CryptoMarketType);
      if (initialData.cryptoCoin) setCryptoCoin(initialData.cryptoCoin);
      if (initialData.cryptoExchange) setCryptoExchange(initialData.cryptoExchange);
      if (initialData.cryptoTimeType) setCryptoTimeType(initialData.cryptoTimeType as CryptoTimeType);
      if (initialData.cryptoHitPriceMode) {
        // legacy: map old hitPriceMode to new type
        if (initialData.cryptoHitPriceMode === "first_to_hit") setCryptoMarketType("first-to-hit");
      }
      if (initialData.cryptoTargetPrices?.length) setCryptoTargetPrices(initialData.cryptoTargetPrices);
      if (initialData.cryptoRanges?.length) setCryptoRanges(initialData.cryptoRanges);
      if (initialData.cryptoHitTargets?.length) setCryptoHitTargets(initialData.cryptoHitTargets);
      if (initialData.cryptoFirstToHits?.length) setCryptoFirstToHits(initialData.cryptoFirstToHits);
    } else if (cat === "sports") {
      if (initialData.candidateId) {
        // 有 candidateId：构造最小候选人对象，直接跳到 config 步骤
        const pseudoCandidate: CandidateResp = {
          id: initialData.candidateId as any,
          title: initialData.candidateTitle || initialData.question || "",
          slug: "",
          startTime: "",
          endTime: "",
          status: "",
          participants: [],
          tags: [],
        } as any;
        setSelectedCandidate(pseudoCandidate);
        // 如果有预填配置，提前写入 sportsConfig（SportsMarketConfigurator 会读取 value prop）
        if (initialData.sportsInitialConfig) {
          const ic = initialData.sportsInitialConfig;
          setSportsConfig((prev) => ({
            enabledTypes: {
              moneyline: ic.enabledTypes?.moneyline ?? prev?.enabledTypes?.moneyline ?? true,
              totals:     ic.enabledTypes?.totals    ?? prev?.enabledTypes?.totals    ?? true,
              spreads:    ic.enabledTypes?.spreads   ?? prev?.enabledTypes?.spreads   ?? true,
            },
            moneylineTeams: ic.moneylineTeams ?? prev?.moneylineTeams ?? [],
            totalsLines:  ic.totalsLines  ?? prev?.totalsLines  ?? ["3.00"],
            spreadsLines: ic.spreadsLines ?? prev?.spreadsLines ?? ["1.00"],
            handicapSide: prev?.handicapSide ?? "home",
          }));
        }
        setStep("config");
        // 异步加载完整候选人详情（补全参与者等信息以初始化 SportsMarketConfigurator）
        setIsLoadingDetail(true);
        getCandidateDetail(initialData.candidateId as any)
          .then((detail) => setCandidateDetail(detail))
          .catch(() => {})
          .finally(() => setIsLoadingDetail(false));
      } else {
        // 没有 candidateId：退回到 candidate 步骤让用户重新选
        setStep("candidate");
        if (initialData.question) setQuestion(initialData.question);
      }
    } else {
      // General / Batch 流程
      setGeneralCategory(cat || "");
      if (initialData.image || initialData.icon) setMarketImage(initialData.image || initialData.icon || "");

      if (initialData.reviewRecord) {
        // 从审核记录列表进入：回填 input + metadata
        const { input, metadata, result, status, id } = initialData.reviewRecord;
        if (metadata?.generalCategory) setGeneralCategory(metadata.generalCategory);
        if (metadata?.image) setMarketImage(metadata.image);
        if (input?.event_title) setBatchEventTitle(input.event_title);
        if (input?.event_desc) setBatchEventDescription(input.event_desc);
        if (input?.event_id) setBatchEventId(input.event_id);
        if (input?.resolution_time) {
          const dateStr = typeof input.resolution_time === 'string'
            ? input.resolution_time.split('T')[0]
            : '';
          if (dateStr) setBatchResolutionDate(dateStr);
        }
        if (input?.markets?.length > 0) {
          const resultMarkets = result?.market_result?.markets || [];
          const kwMap: Record<string, string> = metadata?.marketKeywords || {};
          const ids = Object.keys(kwMap);
          // 如果有 marketKeywords 则按 id 过滤（用户可能删除了部分市场）
          // 如果没有 marketKeywords（审核通过后直接重建），使用所有 input.markets
          const filteredMarkets = ids.length > 0
            ? input.markets.filter((v: any) => ids.includes(String(v.id)))
            : input.markets;

          setBatchMarkets(
            filteredMarkets.map((m: any, i: number) => {
              const rm = resultMarkets.find((r: any) => r.id === m.id);
              const keyword = kwMap[String(m.id)] ?? kwMap[String(i)] ?? m.keyword;
              return {
                id: String(i + 1),
                keyword,
                question: m.title,
                description: m.desc,
                error: status === 'rejected' && rm?.market_error ? rm.market_error : undefined,
              };
            })
          );
        }
        // 从 metadata 还原 tags
        if (metadata?.tagSlugs?.length > 0) {
          const names: string[] = metadata.tagNames || [];
          setBatchTags(
            (metadata.tagSlugs as string[]).map((slug: string, i: number) => ({
              name: names[i] || slug,
              slug,
            }))
          );
          // 同时加载全量 tag 列表，供后续 slug→id 映射
          getMarketTags().then(tags => setMarketTagsList(tags)).catch(() => {});
        }
        // 被拒绝时显示事件级错误
        if (status === 'rejected' && result?.event_result?.event_error) {
          setReviewError(result.event_result.event_error);
        }
        setReviewRecordMode({ id, status });
        setBatchCurrentStep(1);
        setStep("batch_markets");
      } else if (initialData.batchEventTitle != null || initialData.batchEventId != null) {
        // Batch 重新创建：直接跳到 batch_markets 步骤并回填数据
        if (initialData.batchEventTitle) setBatchEventTitle(initialData.batchEventTitle);
        if (initialData.batchEventId != null) setBatchEventId(initialData.batchEventId);
        if (initialData.batchEventDescription) setBatchEventDescription(initialData.batchEventDescription);
        if (initialData.batchResolutionDate) setBatchResolutionDate(initialData.batchResolutionDate);
        if (initialData.batchMarkets && initialData.batchMarkets.length > 0) {
          setBatchMarkets(
            initialData.batchMarkets.map((m, i) => ({
              id: String(i + 1),
              keyword: m.keyword,
              question: m.question,
              description: m.description,
            }))
          );
        }
        // 回填 tags
        if (initialData.batchTags && initialData.batchTags.length > 0) {
          setBatchTags(initialData.batchTags);
          // 加载全量 tag 列表，供后续 slug→id 映射
          getMarketTags().then(tags => setMarketTagsList(tags)).catch(() => {});
        }
        setBatchCurrentStep(1);
        setStep("batch_markets");
      } else {
        // 旧版单一 AI 流程（general_question → AI 生成 → 提交）
        setIsGeneralFlow(true);
        setStep("general_question");
        if (initialData.question) setMarketQuestion(initialData.question);
        if (initialData.title) setAiGeneratedTitle(initialData.title);
        if (initialData.description) setAiGeneratedDesc(initialData.description);
        if (initialData.endDate) setEndDate(initialData.endDate);
      }
    }
  }, [open, initialData]);

  // ============== Batch Event & Markets 状态 ==============
  const [batchEventTitle, setBatchEventTitle] = useState("");
  const [batchEventDescription, setBatchEventDescription] = useState("");
  const [batchEventId, setBatchEventId] = useState<number | null>(null);
  const [batchEventSlug, setBatchEventSlug] = useState<string>("");
  const [isCheckingEvent, setIsCheckingEvent] = useState(false);
  const [eventCheckResult, setEventCheckResult] = useState<"found" | "not_found" | null>(null);
  const [batchMarketInput, setBatchMarketInput] = useState("");
  const [batchMarkets, setBatchMarkets] = useState<BatchMarketItem[]>([]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchResolutionDate, setBatchResolutionDate] = useState("");
  const [batchTags, setBatchTags] = useState<{ name: string; slug: string }[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [availableTags, setAvailableTags] = useState<TagTreeNode[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  // 进度状态仍保留：很多业务回填路径都 setBatchCurrentStep；旧的进度条 UI 已删，
  // 因此 getter 不再使用，只 destructure setter，避免"declared but never read"提示
  const [, setBatchCurrentStep] = useState(0);

  // 事件搜索下拉相关状态
  const [eventSearchResults, setEventSearchResults] = useState<EventSummary[]>([]);
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const eventSearchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSearchRef = useRef<HTMLDivElement>(null);

  // 市场关键词输入列表（第二步表单中用户添加的关键词）
  const [marketKeywords, setMarketKeywords] = useState<string[]>([""]);
  // 生成后「添加更多市场」输入框是否显示
  const [showAddMoreInput, setShowAddMoreInput] = useState(false);
  // 审核相关状态
  const [isReviewingEvent, setIsReviewingEvent] = useState(false);
  const [reviewResult, setReviewResult] = useState<EventReviewResponse | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  // 可用 tags（从 /api/market/tags 查询）
  const [marketTagsList, setMarketTagsList] = useState<TagItem[]>([]);
  const [isSearchingTags, setIsSearchingTags] = useState(false);
  const tagSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tags 下拉框是否展开
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  // 已选择事件时是否锁定字段
  const isEventSelected = !!selectedEvent;
  // 已存在市场折叠状态（通用市场流程）
  const [existingMarketsCollapsed, setExistingMarketsCollapsed] = useState(true);
  // 审核记录模式（从审核列表进入时）
  const [reviewRecordMode, setReviewRecordMode] = useState<{
    id: number;
    status: 'approved' | 'rejected' | 'pending';
  } | null>(null);

  // ============== 通用市场状态 ==============
  const [isGeneralFlow, setIsGeneralFlow] = useState(false);
  const [generalCategory, setGeneralCategory] = useState<string>("");
  const [marketImage, setMarketImage] = useState<string>("");

  // 已选事件中已存在的 market question 集合（用于通用市场流程去重）
  const existingEventMarketQuestions = useMemo(() => {
    if (!selectedEvent?.markets?.length) return new Set<string>();
    return new Set(
      selectedEvent.markets.map((m) => (m.question || "").trim().toLowerCase()).filter(Boolean)
    );
  }, [selectedEvent]);

  // 审核模式下：实时比较当前表单值与 initialData.reviewRecord.input，判断是否有修改
  const isReviewFormDirty = useMemo(() => {
    if (!reviewRecordMode || !initialData?.reviewRecord?.input) return false;
    const inp = initialData.reviewRecord.input;
    const meta = initialData.reviewRecord.metadata || {};
    if ((inp.event_title || '') !== batchEventTitle) return true;
    if ((inp.event_desc || '') !== batchEventDescription) return true;
    if (inp.resolution_time) {
      const origDate = typeof inp.resolution_time === 'string' ? inp.resolution_time.split('T')[0] : '';
      if (origDate !== batchResolutionDate) return true;
    }
    // 比较市场列表（keyword 优先用 metadata.marketKeywords，与回填逻辑一致）
    const kwMap: Record<string, string> = meta.marketKeywords || {};
    const origMarkets = (inp.markets || []).map((m: any, i: number) => {
      const kw = kwMap[String(m.id)] ?? kwMap[String(i)] ?? m.keyword;
      return `${kw}|${m.title}|${m.desc || ''}`;
    });
    const currMarkets = batchMarkets.map((m: any) => `${m.keyword}|${m.question}|${m.description || ''}`);
    if (origMarkets.length !== currMarkets.length) return true;
    for (let i = 0; i < origMarkets.length; i++) {
      if (origMarkets[i] !== currMarkets[i]) return true;
    }
    // 比较 image
    if ((meta.image || '') !== (marketImage || '')) return true;
    // 比较 tags
    const origSlugs = (meta.tagSlugs || []).slice().sort().join(',');
    const currSlugs = batchTags.map(t => t.slug).slice().sort().join(',');
    if (origSlugs !== currSlugs) return true;
    return false;
  }, [reviewRecordMode, initialData, batchEventTitle, batchEventDescription, batchResolutionDate, batchMarkets, marketImage, batchTags]);
  const [marketQuestion, setMarketQuestion] = useState("");
  const [aiGeneratedTitle, setAiGeneratedTitle] = useState("");
  const [aiGeneratedDesc, setAiGeneratedDesc] = useState("");
  const [aiGeneratedRules, setAiGeneratedRules] = useState("");
  const [endDate, setEndDate] = useState("");
  const [uniqueKey, setUniqueKey] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isReviewingAI, setIsReviewingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 用于取消轮询的 ref
  const pollAbortRef = useRef<AbortController | null>(null);

  // 组件卸载时取消轮询
  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  // 轮询检查市场是否已创建成功（markets 数组 > 0）
  const pollForMarkets = useCallback(async (slug: string) => {
    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    const MAX_RETRIES = 10;
    const DELAY_MS = 3000;

    /** 检查每个 market 的每个 outcome 是否都已就绪 */
    const isMarketReady = (eventData: any): boolean => {
      if (!eventData?.markets?.length) return false;
      return eventData.markets.every((market: any) => {
        const outcomes = market.marketOutcomes || [];
        if (outcomes.length === 0) return false;
        return outcomes.every((o: any) =>
          o.tradingPair &&
          o.quantumConversionExponent != null &&
          o.stepBaseQuantums != null &&
          o.subticksPerTick != null
        );
      });
    };

    for (let i = 0; i < MAX_RETRIES; i++) {
      if (controller.signal.aborted) return false;
      await new Promise((r) => setTimeout(r, DELAY_MS));
      if (controller.signal.aborted) return false;
      try {
        const eventData = await getEventBySlug(slug);
        console.log(`[CreateMarket] pollForMarkets attempt ${i + 1}:`, {
          marketsCount: eventData?.markets?.length,
          ready: eventData ? isMarketReady(eventData) : false,
        });
        if (isMarketReady(eventData)) {
          return true;
        }
      } catch (err) {
        if (controller.signal.aborted) return false;
        console.error(`[CreateMarket] pollForMarkets: attempt ${i + 1} error:`, err);
      }
    }
    console.warn(`[CreateMarket] pollForMarkets: max retries reached for slug=${slug}`);
    return false;
  }, []);

  // 重置表单
  const resetForm = useCallback(() => {
    setStep("category");
    setSelectedCategory(null);
    setSelectedCandidate(null);
    setCandidateDetail(null);
    setIsLoadingDetail(false);
    setSubType("moneyline");
    setMarketValue("");
    setTotalsLines([""]);
    setSpreadLines([""]);
    setQuestion("");
    setGroupItemTitle("");
    setOutcomes([]);
    setSelectedOutcome("");
    setSportsConfig(null);
    setExistingSportsMarkets([]);
    setIsLoadingExistingSportsMarkets(false);
    setSearchQuery("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setIsSubmitting(false);
    setSubmitError(null);
    setResult(null);
    setProcessingStep("");
    // General market state
    setIsGeneralFlow(false);
    setGeneralCategory("");
    setMarketImage("");
    setMarketQuestion("");
    setAiGeneratedTitle("");
    setAiGeneratedDesc("");
    setAiGeneratedRules("");
    setEndDate("");
    setUniqueKey("");
    setIsGeneratingAI(false);
    setIsReviewingAI(false);
    setAiError(null);
    // Crypto state
    setCryptoMarketType("above");
    setCryptoCoin("");
    setCryptoDate("");
    setCryptoExchange("");
    setCryptoTimeType("daily");
    setCryptoTargetPrices([""]);
    setCryptoRanges([{ low: "", high: "", direction: "range" }]);
    setCryptoHitTargets([""]);
    setCryptoFirstToHits([{ priceA: "", priceB: "" }]);
    setCoinSearchQuery("");
    setCryptoCoinsData([]);
    setCryptoExchangesData([]);
    setCryptoCoinsLoading(false);
    if (coinSearchTimerRef.current) { clearTimeout(coinSearchTimerRef.current); coinSearchTimerRef.current = null; }
    setSelectedCryptoEvent(null);
    setCryptoEventSearchQuery("");
    setCryptoEventResults([]);
    setIsSearchingCryptoEvents(false);
    setCryptoEventExistingMarkets([]);
    setIsLoadingCryptoEventMarkets(false);
    setCryptoExistingMarketsCollapsed(true);
    if (cryptoEventSearchTimerRef.current) { clearTimeout(cryptoEventSearchTimerRef.current); cryptoEventSearchTimerRef.current = null; }
    // Batch Event & Markets state
    setBatchEventTitle("");
    setBatchEventDescription("");
    setBatchEventId(null);
    setBatchEventSlug("");
    setIsCheckingEvent(false);
    setEventCheckResult(null);
    setBatchMarketInput("");
    setBatchMarkets([]);
    setIsGeneratingBatch(false);
    setBatchResolutionDate("");
    setBatchTags([]);
    setTagSearchQuery("");
    setAvailableTags([]);
    setIsLoadingTags(false);
    setBatchCurrentStep(0);
    // 事件搜索 & 审核状态
    setEventSearchResults([]);
    setIsSearchingEvents(false);
    setShowEventDropdown(false);
    setSelectedEvent(null);
    setMarketKeywords([""]);
    setShowAddMoreInput(false);
    setIsReviewingEvent(false);
    setReviewResult(null);
    setReviewError(null);
    setMarketTagsList([]);
    setIsSearchingTags(false);
    setTagDropdownOpen(false);
    setReviewRecordMode(null);
    if (eventSearchTimerRef.current) { clearTimeout(eventSearchTimerRef.current); eventSearchTimerRef.current = null; }
    if (tagSearchTimerRef.current) { clearTimeout(tagSearchTimerRef.current); tagSearchTimerRef.current = null; }
  }, []);

  // 处理关闭
  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange?.(false);
  }, [resetForm, onOpenChange]);

  const createEntrySource = useMemo(() => {
    if (initialData?.reviewRecord) return "review_record";
    if (initialData) return "recreate";
    return "create_button";
  }, [initialData]);

  const openTrackedRef = useRef(false);
  useEffect(() => {
    if (open && !openTrackedRef.current) {
      trackEvent("market_create_open", { source: createEntrySource });
      openTrackedRef.current = true;
    }
    if (!open) {
      openTrackedRef.current = false;
    }
  }, [open, createEntrySource]);

  const getCreateErrorReason = useCallback((err: any): string => {
    const raw = err?.message ? String(err.message) : "unknown_error";
    return raw.slice(0, 160);
  }, []);

  const trackCreateSubmit = useCallback((flow: string, marketCount: number) => {
    trackEvent("market_create_submit", { flow, market_count: marketCount });
  }, []);

  const trackCreateSuccess = useCallback(
    (flow: string, marketCount: number, eventSlug?: string, marketId?: string) => {
      trackEvent("market_create_success", { flow, market_count: marketCount, event_slug: eventSlug, market_id: marketId });
    },
    []
  );

  const trackCreateFailed = useCallback((flow: string, reason?: string) => {
    trackEvent("market_create_failed", { flow, reason });
  }, []);

  // 选择分类
  const handleSelectCategory = useCallback(
    (category: TagResp) => {
      setSelectedCategory(category);
      filterBySlug(category.slug);
      setStep("candidate");
    },
    [filterBySlug]
  );

  // 选择候选事件
  const handleSelectCandidate = useCallback(
    async (candidate: CandidateResp) => {
      setSelectedCandidate(candidate);
      setCandidateDetail(null); // 清空旧数据
      setIsLoadingDetail(true);

      try {
        const detail = await getCandidateDetail(candidate.id);
        setCandidateDetail(detail);
        setQuestion(candidate.title);
        setStep("config");
      } catch (err) {
        console.error("Failed to load candidate detail:", err);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    []
  );

  useEffect(() => {
    if (step !== "config" || !selectedCandidate?.id || generalCategory !== "sports") {
      setExistingSportsMarkets([]);
      setIsLoadingExistingSportsMarkets(false);
      return;
    }

    let cancelled = false;
    setIsLoadingExistingSportsMarkets(true);
    getCandidateCreatedMarkets(selectedCandidate.id)
      .then((resp) => {
        if (cancelled) return;
        const markets = resp?.data?.markets;
        setExistingSportsMarkets(Array.isArray(markets) ? markets : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch existing sports markets:", err);
        setExistingSportsMarkets([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingExistingSportsMarkets(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [step, selectedCandidate?.id, generalCategory]);

  // 处理 subType 变更
  const handleSubTypeChange = useCallback(
    (newSubType: MarketSubType) => {
      setSubType(newSubType);
      setOutcomes(getDefaultOutcomes(newSubType, selectedCandidate));
      setSelectedOutcome("");

      // 清空 marketValue 如果不需要
      if (!requiresMarketValue(newSubType)) {
        setMarketValue("");
      }
    },
    [selectedCandidate]
  );

  // 处理 MONEYLINE 选项选择
  const handleMoneylineSelect = useCallback((participantName: string) => {
    setSelectedOutcome(participantName);
    if (participantName === "DRAW") {
      setOutcomes([{ name: "Draw", outcomeKey: "DRAW", originalIndex: 0 }]);
    } else {
      setOutcomes([
        {
          name: participantName,
          outcomeKey: participantName.toUpperCase(),
          originalIndex: 0,
        },
      ]);
    }
  }, []);

  // ============== 通用市场处理函数 ==============

  // 选择通用市场分类
  const handleSelectGeneralCategory = useCallback((categorySlug: string) => {
    setGeneralCategory(categorySlug);
    if (categorySlug === "sports") {
      // Sports 走原有流程
      setIsGeneralFlow(false);
    } else {
      // 非 Sports 走通用流程
      setIsGeneralFlow(true);
    }
  }, []);

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // 处理图片上传
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 检查文件大小 (最大 8MB)
      if (file.size > 8 * 1024 * 1024) {
        toast.error(t.market.create.imageSizeTooLarge);
        return;
      }

      setIsUploadingImage(true);
      try {
        // 调用上传接口
        const response = await uploadFile(file);
        if (response.success && response.data?.url) {
          const imageUrl = response.data.url;

          // AI 图片审核
          try {
            const reviewResp = await reviewMarketImage(imageUrl);
            if (reviewResp.code === 2000 && reviewResp.data?.status === false) {
              throw new Error(
                reviewResp.data.error_message ||
                  "Image did not pass AI review"
              );
            }
          } catch (reviewErr: any) {
            // 审核不通过或审核接口异常
            if (fileInputRef.current) fileInputRef.current.value = "";
            throw new Error(
              reviewErr.message || "Image review failed"
            );
          }

          setMarketImage(imageUrl);
          toast.success(t.market.create.imageUploadSuccess);
        } else {
          throw new Error(response.msg || "Upload failed");
        }
      } catch (error) {
        console.error("Image upload failed:", error);
        toast.error(
          error instanceof Error ? error.message : t.market.create.imageUploadFailed
        );
      } finally {
        setIsUploadingImage(false);
      }
    },
    [toast, t]
  );

  // 移除图片
  const handleRemoveImage = useCallback(() => {
    setMarketImage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // AI 生成市场详情
  const handleGenerateMarketDetails = useCallback(async () => {
    if (!marketQuestion.trim()) {
      toast.error(t.market.create.pleaseEnterQuestion);
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);

    try {
      // 调用 AI 补全接口
      const result = await aiSupplementMarket({
        market_title: marketQuestion.trim(),
      });

      setAiGeneratedTitle(result.market_title);
      setAiGeneratedDesc(result.market_desc);
      setAiGeneratedRules(result.market_desc); // 规则默认使用描述
      setEndDate(timestampToDateString(result.resolution_time));

      setStep("general_details");
    } catch (err: any) {
      setAiError(err.message || t.market.create.aiGenerationFailed);
      toast.error(err.message || t.market.create.aiGenerationFailed);
    } finally {
      setIsGeneratingAI(false);
    }
  }, [marketQuestion, toast]);

  // AI 审核并获取 unique_key
  const handleAIReview = useCallback(async () => {
    if (!aiGeneratedTitle || !aiGeneratedDesc || !endDate) {
      toast.error(t.market.create.fillAllRequired);
      return;
    }

    setIsReviewingAI(true);
    setAiError(null);

    try {
      const resolutionTime = dateStringToTimestamp(endDate);

      // 调用 AI 审核接口
      const result = await aiReviewMarket({
        market_title: aiGeneratedTitle,
        market_desc: aiGeneratedRules || aiGeneratedDesc,
        resolution_time: resolutionTime,
      });

      if (result.review_result.status !== "approved") {
        throw new Error(t.market.create.reviewNotApproved + ": " + result.error_message);
      }

      setUniqueKey(result.review_result.unique_key);
      setStep("general_preview");
    } catch (err: any) {
      setAiError(err.message || t.market.create.aiReviewFailed);
      toast.error(err.message || t.market.create.aiReviewFailed);
    } finally {
      setIsReviewingAI(false);
    }
  }, [aiGeneratedTitle, aiGeneratedDesc, aiGeneratedRules, endDate, toast]);

  // 提交通用市场
  const handleSubmitGeneralMarket = useCallback(async () => {
    const userAddress =
      backendUser?.smartAccountAddress || smartAccountAddress || "";
    if (!userAddress) {
      toast.error(t.market.common.connectWalletFirst);
      return;
    }

    if (!uniqueKey) {
      toast.error(t.market.create.missingUniqueKey);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setStep("processing");
    const reviewFlow = reviewRecordMode ? "review_v2" : "batch_v2";
    trackCreateSubmit(reviewFlow, batchMarkets.length);
    trackCreateSubmit("batch", batchMarkets.length);
    trackCreateSubmit("general", 1);

    try {
      // 单步：调用 To-B 控制器（替换原 createGeneralMarket → confirmMarkets →
      // ensureMarketCreationBalance → initializeMarket 链路；合约由后端代办）
      setProcessingStep(t.market.create.creatingMarket);

      const description = aiGeneratedRules || aiGeneratedDesc;
      const resolutionDateMs = endDate
        ? new Date(endDate + "T23:59:59Z").getTime()
        : undefined;

      const tobReq: TobUmaMarketCreateReq = {
        betId: newBetId(),
        type: "common",
        betAmount: getDefaultCreateBetAmount(),
        eventTitle: aiGeneratedTitle,
        description,
        marketType: "BINARY",
        tags: [generalCategory].filter(Boolean) as string[],
        outcomes: [
          { name: "Yes", question: aiGeneratedTitle, slug: "yes" },
          { name: "No", question: aiGeneratedTitle, slug: "no" },
        ],
        image: marketImage || undefined,
        commonResolutionDate: resolutionDateMs,
      };

      const tobResp = await tobApi.createUmaMarket(tobReq);
      // 详情页 /market/[id] 走 getEventBySlug 拉 event
      // 优先用后端返的 slug，其次 eventId，再次 marketIds[0]。
      const slug = tobResp.slug || "";
      const createdMarketId =
        tobResp.eventId || tobResp.marketIds?.[0] || "";

      // 后端 HTTP 200 不代表 indexer 已追上：轮询 getEventBySlug 直到 markets
      // 的 outcome 都有 tradingPair/quantums，否则把 pendingIndexing 透传给
      // Success 页改变 CTA（去创建记录而非详情页），避免用户进详情页下不了单
      let indexingReady = true;
      if (slug) {
        setProcessingStep(t.market.common.verifyingMarket);
        indexingReady = await pollForMarkets(slug);
      }

      trackCreateSuccess("general", 1, slug || undefined, createdMarketId);
      toast.success(t.market.common.marketCreatedSuccess);
      setResult({
        marketId: createdMarketId,
        slug,
        pendingIndexing: !!slug && !indexingReady,
      } as any);
      setStep("success");
    } catch (err: any) {
      console.error("[CreateMarket] General market creation failed:", err);
      trackCreateFailed("general", getCreateErrorReason(err));
      toast.error(err.message || t.market.common.createMarketFailed);
      setSubmitError(err.message || t.market.common.createMarketFailed);
      setStep("general_preview");
    } finally {
      setIsSubmitting(false);
      setProcessingStep("");
    }
  }, [
    backendUser,
    smartAccountAddress,
    uniqueKey,
    aiGeneratedTitle,
    aiGeneratedDesc,
    aiGeneratedRules,
    endDate,
    generalCategory,
    marketImage,
    initializeMarket,
    ensureMarketCreationBalance,
    pollForMarkets,
    toast,
    t,
    trackCreateSubmit,
    trackCreateSuccess,
    trackCreateFailed,
    getCreateErrorReason,
  ]);

  // 提交创建 - 新版完整流程 (Sports) - 使用 MarketNewGameReq 批量创建
  const handleSubmit = useCallback(async () => {
    if (!selectedCandidate) return;

    console.log('selectedCandidate',selectedCandidate);
    
    // 获取用户钱包地址
    const userAddress =
      backendUser?.smartAccountAddress || smartAccountAddress || "";
    if (!userAddress) {
      toast.error(t.market.common.connectWalletFirst);
      return;
    }

    // 需要有多盘配置结果
    if (!sportsConfig) {
      toast.error(t.market.create.pleaseAddAtLeastOneMarket);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setStep("processing");

    try {
      // Step 1: 组装 MarketNewGameReq
      setProcessingStep(t.market.create.creatingMarket);

      const uniqueValues = (values: string[]) => Array.from(new Set(values));
      // 只排除已成功部署的市场，DRAFT/DEPLOYING/DEPLOY_FAILED 需要重新部署
      const deployedSportsMarkets = existingSportsMarkets.filter(isDeployedMarket);
      const existingMoneylineOptionsSet = new Set(
        deployedSportsMarkets
          .filter((market) => market.type.toUpperCase() === "MONEYLINE")
          .map((market) => normalizeSportsOptionValue(market.option))
          .filter(Boolean)
      );
      const existingTotalsLineSet = new Set(
        deployedSportsMarkets
          .filter((market) => market.type.toUpperCase() === "TOTALS" && market.line != null)
          .map((market) => normalizeSportsLineValue(market.line))
          .filter(Boolean)
      );
      const existingSpreadsLineSet = new Set(
        deployedSportsMarkets
          .filter((market) => market.type.toUpperCase() === "SPREADS" && market.line != null)
          .map((market) => normalizeSportsLineValue(market.line, true))
          .filter(Boolean)
      );
      const marketsPayload: {
        marketType: string;
        outcomes: string[];
      }[] = [];

      // moneyline：使用 participants.id + 可选 DRAW（来自 SportsMarketConfigurator）
      if (
        sportsConfig.enabledTypes.moneyline &&
        sportsConfig.moneylineTeams.length > 0
      ) {
        const moneylineIds = sportsConfig.moneylineTeams
          .filter((team) => !existingMoneylineOptionsSet.has(normalizeSportsOptionValue(team.name)))
          .map((team) => team.id);
        if (moneylineIds.length) {
          marketsPayload.push({
            marketType: "moneyline",
            outcomes: uniqueValues(moneylineIds),
          });
        }
      }

      // totals：所有合法 line 放在同一个市场的 outcomes 里
      if (sportsConfig.enabledTypes.totals) {
        const totalsLines = (sportsConfig.totalsLines || [])
          .map((v) => normalizeSportsLineValue(v))
          .filter((v) => v && !Number.isNaN(Number(v)) && !existingTotalsLineSet.has(v));
        if (totalsLines.length) {
          marketsPayload.push({
            marketType: "totals",
            outcomes: uniqueValues(totalsLines.map((v) => String(Number(v)))),
          });
        }
      }

      // spreads：传用户输入的原始值（如 ["1"] 或 ["-1"]），后端根据值生成正负双方
      if (sportsConfig.enabledTypes.spreads) {
        const spreadLines = (sportsConfig.spreadsLines || [])
          .map((v) => normalizeSportsLineValue(v, true))
          .filter((v) => v && !Number.isNaN(Number(v)) && !existingSpreadsLineSet.has(v))
          .map((v) => String(Number(v)));
        if (spreadLines.length) {
          marketsPayload.push({
            marketType: "spreads",
            outcomes: uniqueValues(spreadLines),
          });
        }
      }

      if (!marketsPayload.length) {
        toast.error(t.market.create.sportsConfigurator.noNewMarketsToCreate);
        throw new Error("no_new_markets_configured");
      }

      trackCreateSubmit("sports", marketsPayload.length);

      const gameReq = {
        gameId:selectedCandidate.id,
        markets: marketsPayload,
      };

      console.log("[CreateMarket] Sports tob payload", gameReq);

      // 单步：调用 To-B 控制器 sports 分支（替换原 createSportsMarkets →
      // confirmMarkets → ensureMarketCreationBalance → batchInitializeMarkets 链路；
      // gameplay oracle 映射也由后端处理）
      const tobReq: TobUmaMarketCreateReq = {
        betId: newBetId(),
        type: "sports",
        betAmount: getDefaultCreateBetAmount(),
        gameId: String(gameReq.gameId),
        markets: gameReq.markets,
      };
      const tobResp = await tobApi.createUmaMarket(tobReq);
      const createdCount = tobResp.marketIds?.length ?? 0;

      const sportsSlug = tobResp.slug || "";

      let indexingReady = true;
      if (sportsSlug) {
        setProcessingStep(t.market.common.verifyingMarket);
        indexingReady = await pollForMarkets(sportsSlug);
      }

      trackCreateSuccess("sports", createdCount, sportsSlug || undefined);
      toast.success(t.market.common.marketCreatedSuccess);
      setResult({
        // 详情页优先用 slug，没有再回落 eventId
        marketId: tobResp.eventId || tobResp.marketIds?.[0] || "",
        slug: sportsSlug,
        createdCount,
        failedCount: 0,
        failedMarkets: [],
        pendingIndexing: !!sportsSlug && !indexingReady,
      });
      setStep("success");
    } catch (err: any) {
      console.error("[CreateMarket] 创建失败:", err);
      trackCreateFailed("sports", getCreateErrorReason(err));
      toast.error(err.message || t.market.common.createMarketFailed);
      setSubmitError(err.message || t.market.common.createMarketFailed);
      setStep("confirm"); // 回到确认步骤以便重试
    } finally {
      setIsSubmitting(false);
      setProcessingStep("");
    }
  }, [
    selectedCandidate,
    selectedCategory,
    sportsConfig,
    backendUser,
    smartAccountAddress,
    marketImage,
    batchInitializeMarkets,
    ensureMarketCreationBalance,
    existingSportsMarkets,
    pollForMarkets,
    toast,
    t,
    trackCreateSubmit,
    trackCreateSuccess,
    trackCreateFailed,
    getCreateErrorReason,
  ]);

  // 获取参与者选项 (用于 MONEYLINE)
  // 优先用 candidateDetail.participants；若无则降级到已回填的 outcomes
  const participantOptions = useMemo(() => {
    if (candidateDetail?.participants && candidateDetail.participants.length > 0) {
      const options = candidateDetail.participants.map((p) => ({
        value: p.name,
        label: p.name,
        alignment: p.alignment,
      }));
      options.push({ value: "DRAW", label: "Draw", alignment: "" });
      return options;
    }

    // 降级：用 outcomes state 构建选项（回填场景无 candidateDetail 时）
    if (outcomes.length > 0) {
      return outcomes.map((o) => ({
        value: o.name,
        label: o.name,
        alignment: "",
      }));
    }

    return [];
  }, [candidateDetail, outcomes]);

  // 只排除已成功部署的市场用于 UI 重复检测
  const deployedSportsMarketsForUI = useMemo(
    () => existingSportsMarkets.filter(isDeployedMarket),
    [existingSportsMarkets]
  );

  const existingMoneylineOptions = useMemo(
    () => new Set(
      deployedSportsMarketsForUI
        .filter((market) => market.type.toUpperCase() === "MONEYLINE")
        .map((market) => normalizeSportsOptionValue(market.option))
        .filter(Boolean)
    ),
    [deployedSportsMarketsForUI]
  );

  const existingTotalsLineSet = useMemo(
    () => new Set(
      deployedSportsMarketsForUI
        .filter((market) => market.type.toUpperCase() === "TOTALS" && market.line != null)
        .map((market) => normalizeSportsLineValue(market.line))
        .filter(Boolean)
    ),
    [deployedSportsMarketsForUI]
  );

  const existingSpreadsLineSet = useMemo(
    () => new Set(
      deployedSportsMarketsForUI
        .filter((market) => market.type.toUpperCase() === "SPREADS" && market.line != null)
        .map((market) => normalizeSportsLineValue(market.line, true))
        .filter(Boolean)
    ),
    [deployedSportsMarketsForUI]
  );

  const sportsExistingDuplicateState = useMemo(() => {
    if (!sportsConfig) {
      return { totals: false, spreads: false };
    }

    return {
      totals:
        !!sportsConfig.enabledTypes.totals &&
        (sportsConfig.totalsLines ?? []).some((value) => {
          const normalized = normalizeSportsLineValue(value);
          return !!normalized && existingTotalsLineSet.has(normalized);
        }),
      spreads:
        !!sportsConfig.enabledTypes.spreads &&
        (sportsConfig.spreadsLines ?? []).some((value) => {
          const normalized = normalizeSportsLineValue(value, true);
          return !!normalized && existingSpreadsLineSet.has(normalized);
        }),
    };
  }, [sportsConfig, existingTotalsLineSet, existingSpreadsLineSet]);

  const hasCreatableSportsMarkets = useMemo(() => {
    if (!sportsConfig) return false;

    const hasNewMoneyline =
      !!sportsConfig.enabledTypes.moneyline &&
      sportsConfig.moneylineTeams.some(
        (team) => !existingMoneylineOptions.has(normalizeSportsOptionValue(team.name))
      );

    const hasNewTotals =
      !!sportsConfig.enabledTypes.totals &&
      (sportsConfig.totalsLines ?? []).some((value) => {
        const normalized = normalizeSportsLineValue(value);
        return (
          !!normalized &&
          !Number.isNaN(Number(normalized)) &&
          !existingTotalsLineSet.has(normalized)
        );
      });

    const hasNewSpreads =
      !!sportsConfig.enabledTypes.spreads &&
      (sportsConfig.spreadsLines ?? []).some((value) => {
        const normalized = normalizeSportsLineValue(value, true);
        return (
          !!normalized &&
          !Number.isNaN(Number(normalized)) &&
          !existingSpreadsLineSet.has(normalized)
        );
      });

    return hasNewMoneyline || hasNewTotals || hasNewSpreads;
  }, [sportsConfig, existingMoneylineOptions, existingTotalsLineSet, existingSpreadsLineSet]);

  // 渲染分类选择 (新版：包含通用市场分类和图片上传)
  const renderCategoryStep = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* 左侧：分类选择 */}
        <div className="flex-1">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            {t.market.create.category}
          </h4>
          <div className="flex flex-wrap gap-2">
            {/* Asian 分类按钮 */}
            <button
              onClick={() => handleSelectGeneralCategory('asian')}
              className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${
                generalCategory === 'asian'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-black'
                  : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent)]'
              }`}
            >
              {t.sports.nav.asian}
            </button>
            {isLoadingCategories ? (
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t.market.create.loadingCategories}</span>
              </div>
            ) : categories.length > 0 ? (
              categories.map((cat) => (
                <button
                  key={cat.id || cat.slug}
                  onClick={() => handleSelectGeneralCategory(cat.slug || "")}
                  className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${generalCategory === cat.slug
                    ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                    : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent)]"
                    }`}
                >
                  {cat.label}
                </button>
              ))
            ) : (
              <span className="text-sm text-[var(--text-tertiary)]">
                {t.market.create.noCategoriesAvailable}
              </span>
            )}
          </div>
        </div>

        {/* 右侧：图片上传（仅图片必填的分类显示） */}
        {generalCategory && generalCategory !== 'asian' && generalCategory !== 'sports' && generalCategory !== 'crypto' && (
        <div className="w-full md:w-64">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            {t.market.create.marketImage} <span className="text-red-500">*</span>{" "}
            <span className="text-xs text-[var(--text-tertiary)]">
              {t.market.create.maxSize}
            </span>
          </h4>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {marketImage ? (
              <div className="relative w-full aspect-square rounded-xl border-2 border-dashed border-[var(--accent)] overflow-hidden">
                <img
                  src={marketImage}
                  alt="Market"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="w-full aspect-square rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingImage ? (
                  <>
                    <Loader2 className="w-8 h-8 text-[var(--text-secondary)] animate-spin" />
                    <span className="text-sm text-[var(--text-secondary)]">
                      {t.market.create.uploading}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-secondary)]">
                      {t.market.create.uploadImage}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 下一步按钮 */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (generalCategory === 'asian') {
              // Asian 分类：关闭弹窗并跳转到 sports open-market 页面
              onOpenChange?.(false);
              resetForm();
              router.push('/sports/open-market');
            } else if (generalCategory === 'sports') {
              // Sports 走原有流程 - 直接使用 API 分类或创建临时分类对象
              const sportsCat = categories.find(
                (c) =>
                  c.slug?.toLowerCase() === "sports" ||
                  c.label?.toLowerCase() === "sports"
              );
              if (sportsCat) {
                handleSelectCategory(sportsCat);
              } else {
                // 如果 API 分类未加载，创建临时分类对象
                handleSelectCategory({
                  id: "sports",
                  slug: "sports",
                  label: "Sports",
                } as any);
              }
            } else if (generalCategory === 'crypto') {
              setStep("crypto_select_event");
            } else if (generalCategory) {
              // 通用市场流程 → 新版批量创建
              setBatchCurrentStep(0);
              setStep("event_info");
            }
          }}
          disabled={!generalCategory || (generalCategory !== 'asian' && generalCategory !== 'sports' && generalCategory !== 'crypto' && !marketImage)}
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.market.common.next}
        </button>
      </div>
    </div>
  );

  // 渲染候选事件选择
  const renderCandidateStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => resetForm()}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.selectEvent} - {selectedCategory?.label}
        </h3>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          type="text"
          placeholder={t.market.create.searchEvent}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
          }}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* 日期范围筛选 */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <DatePicker
            value={dateRangeStart ? dayjs(dateRangeStart) : null}
            onChange={(date) => {
              const val = date ? date.format('YYYY-MM-DD') : '';
              setDateRangeStart(val);
              const start = val ? new Date(val).getTime() : undefined;
              const end = dateRangeEnd ? new Date(dateRangeEnd + 'T23:59:59').getTime() : undefined;
              filterByDateRange(start, end);
            }}
            className="w-full"
            size="middle"
            placeholder={t.market.create.startDate || "Start"}
            style={{ borderRadius: '0.5rem' }}
          />
        </div>
        <span className="text-[var(--text-tertiary)] text-sm">—</span>
        <div className="flex-1">
          <DatePicker
            value={dateRangeEnd ? dayjs(dateRangeEnd) : null}
            onChange={(date) => {
              const val = date ? date.format('YYYY-MM-DD') : '';
              setDateRangeEnd(val);
              const start = dateRangeStart ? new Date(dateRangeStart).getTime() : undefined;
              const end = val ? new Date(val + 'T23:59:59').getTime() : undefined;
              filterByDateRange(start, end);
            }}
            className="w-full"
            size="middle"
            placeholder={t.market.create.endDate || "End"}
            style={{ borderRadius: '0.5rem' }}
          />
        </div>
        {(dateRangeStart || dateRangeEnd) && (
          <button
            onClick={() => {
              setDateRangeStart("");
              setDateRangeEnd("");
              filterByDateRange(undefined, undefined);
            }}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 候选事件列表 */}
      {isLoadingCandidates && candidates.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => handleSelectCandidate(candidate)}
              disabled={isLoadingDetail}
              className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-[var(--text-primary)] truncate">
                    {candidate.title}
                  </h4>
                  {candidate.description && (
                    <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {candidate.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-secondary)]">
                    {candidate.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(Number(candidate.startDate)).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {candidate.participants &&
                      candidate.participants.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {candidate.participants.length}{" "}
                          {t.market.create.participants}
                        </span>
                      )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)] flex-shrink-0" />
              </div>
            </button>
          ))}

          {/* 滚动加载哨兵：进入视口时自动触发 loadMore */}
          <div ref={candidateListSentinelRef} className="h-1" />

          {isLoadingCandidates && candidates.length > 0 && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
            </div>
          )}

          {candidates.length === 0 && !isLoadingCandidates && (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              {t.market.create.noEvents}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // 渲染配置步骤
  // 渲染配置步骤（使用 SportsMarketConfigurator）
const renderConfigStep = () => {
  const isQuarterMultiple = (raw: string) => {
    const s = raw.trim();
    if (!s) return false;
    const n = Number(s);
    if (!Number.isFinite(n)) return false;
    const scaled = n * 4;
    return Number.isInteger(scaled) || Math.abs(scaled - Math.round(scaled)) < 1e-9;
  };

  const teams: MoneylineTeam[] =
    candidateDetail?.participants?.map((p, idx) => ({
      id: p.id ? String(p.id) : `team-${idx}`,
      name: p.name || `Team ${idx + 1}`,
    })) ?? [];

  const gameDateISO = (() => {
    const raw = candidateDetail?.startDate;
    if (!raw) return null;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return null;
    const ms = ts < 1e12 ? ts * 1000 : ts;
    return new Date(ms).toISOString();
  })();

  const totalsInvalid =
    !!sportsConfig?.enabledTypes.totals &&
    (sportsConfig?.totalsLines ?? []).some(
      (v) => v.trim().length > 0 && !isQuarterMultiple(v)
    );
  const spreadsInvalid =
    !!sportsConfig?.enabledTypes.spreads &&
    (sportsConfig?.spreadsLines ?? []).some(
      (v) => v.trim().length > 0 && !isQuarterMultiple(v)
    );
  const hasValidationError =
    totalsInvalid ||
    spreadsInvalid ||
    sportsExistingDuplicateState.totals ||
    sportsExistingDuplicateState.spreads;

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => resetForm()}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {t.market.create.configMarket}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!sportsConfig) {
              toast.error(t.market.create.pleaseAddAtLeastOneMarket);
              return;
            }
            if (hasValidationError) {
              toast.error(
                sportsExistingDuplicateState.totals || sportsExistingDuplicateState.spreads
                  ? t.market.create.sportsConfigurator.existingDuplicate
                  : t.market.create.sportsConfigurator.mustBeQuarterMultiple
              );
              return;
            }
            if (!hasCreatableSportsMarkets) {
              toast.error(t.market.create.sportsConfigurator.noNewMarketsToCreate);
              return;
            }
            setStep("confirm");
          }}
          disabled={!sportsConfig || hasValidationError || !hasCreatableSportsMarkets}
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.market.common.next}
        </button>
      </div>

      <SportsMarketConfigurator
        gameTitle={selectedCandidate?.title || "-"}
        gameDateISO={gameDateISO}
        initialTeams={teams}
        value={sportsConfig}
        onChange={setSportsConfig}
        existingMarkets={existingSportsMarkets}
        loadingExistingMarkets={isLoadingExistingSportsMarkets}
      />
    </div>
  );
};

  // 渲染确认步骤
  const renderConfirmStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setSubmitError(null); resetForm(); }}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.confirmCreate}
        </h3>
      </div>

      {/* 市场预览 */}
      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3">
        <div>
          <span className="text-sm text-[var(--text-secondary)]">
            {t.market.create.selectLeague}
          </span>
          <p className="font-medium text-[var(--text-primary)]">
            {selectedCandidate?.title}
          </p>
        </div>

        <div>
          <span className="text-sm text-[var(--text-secondary)]">
            {t.market.create.marketType}
          </span>
          <p className="font-medium text-[var(--text-primary)]">
            {subType === "moneyline"
              ? t.market.create.subTypeMoneyline
              : subType === "spreads"
                ? t.market.create.subTypeSpreads
                : t.market.create.subTypeTotals}
          </p>
        </div>

        {marketValue && (
          <div>
            <span className="text-sm text-[var(--text-secondary)]">
              {t.market.create.totalLine}
            </span>
            <p className="font-medium text-[var(--text-primary)]">
              {marketValue}
            </p>
          </div>
        )}

        {outcomes.length > 0 && (
          <div>
            <span className="text-sm text-[var(--text-secondary)]">
              {t.market.create.participants}
            </span>
            <p className="font-medium text-[var(--text-primary)]">
              {outcomes.map((o) => o.name).join(" / ")}
            </p>
          </div>
        )}

        <div>
          <span className="text-sm text-[var(--text-secondary)]">
            {t.market.create.marketQuestion}
          </span>
          <p className="font-medium text-[var(--text-primary)]">
            {question || selectedCandidate?.title}
          </p>
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-500">
              {t.market.create.createFailed}
            </p>
            <p className="text-xs text-red-400 mt-1 break-words">
              {submitError}
            </p>
          </div>
        </div>
      )}

      {/* 创建按钮 */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full py-3 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t.market.create.creating}
          </>
        ) : (
          t.market.create.confirmCreate
        )}
      </button>
    </div>
  );

  // 渲染处理中步骤
  const renderProcessingStep = () => (
    <div className="text-center py-8 space-y-4">
      <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
      <h3 className="text-xl font-semibold text-[var(--text-primary)]">
        {t.market.create.creating}
      </h3>
      <p className="text-[var(--text-secondary)]">
        {processingStep || t.market.create.pleaseWait}
      </p>
      {initStatus && (
        <p className="text-sm text-[var(--text-secondary)]">{initStatus}</p>
      )}
    </div>
  );

  // 渲染成功步骤
  const renderSuccessStep = () => {
    const pendingIndexing = result?.pendingIndexing === true;

    // 完全就绪：跳市场详情页；索引中：跳个人资料 → 创建记录 tab，
    // 避免用户进详情页发现还不能下单以为 bug
    const handlePrimaryAction = () => {
      let targetUrl = "";
      if (pendingIndexing) {
        targetUrl = "/pna?tab=records";
      } else {
        const slug = result?.slug;
        if (slug && (generalCategory === "sports" || selectedCategory?.slug === "sports")) {
          targetUrl = buildSportsEventUrl(slug, batchTags.length > 0 ? batchTags : undefined);
        } else if (slug) {
          targetUrl = `/market/${slug}`;
        } else if (result?.marketId) {
          targetUrl = `/market/${result.marketId}`;
        }
      }
      handleClose();
      if (targetUrl) {
        router.push(targetUrl);
      }
    };

    const createdCount = result?.createdCount;
    const failedCount = result?.failedCount;

    return (
      <div className="text-center py-8 space-y-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
            pendingIndexing ? "bg-amber-500/10" : "bg-green-500/10"
          }`}
        >
          {pendingIndexing ? (
            <Clock className="w-8 h-8 text-amber-500" />
          ) : (
            <Check className="w-8 h-8 text-green-500" />
          )}
        </div>
        <h3 className="text-xl font-semibold text-(--text-primary)">
          {pendingIndexing
            ? t.market.create.marketPendingTitle
            : t.market.common.marketCreatedSuccess}
        </h3>
        <p className="text-(--text-secondary)">
          {pendingIndexing
            ? t.market.create.marketPendingMessage
            : (t.market.create.marketLiveMessage ||
              "Your market is now live and visible to others.")}
        </p>
        {/* createdCount / failedCount 只在完全就绪态显示；pending 时隐藏
            避免用户看到"索引中"又看到"成功创建 N 个"产生认知冲突 */}
        {!pendingIndexing &&
          (typeof createdCount === "number" || typeof failedCount === "number") && (
          <div className="max-w-md mx-auto p-4 rounded-xl border border-(--border) bg-(--bg-secondary) text-left space-y-2">
            {typeof createdCount === "number" && createdCount > 0 && (
              <p className="text-sm text-(--text-primary)">
                {t.market.create.sportsCreatedCount(createdCount)}
              </p>
            )}
            {typeof failedCount === "number" && failedCount > 0 && (
              <p className="text-sm text-(--text-secondary)">
                {t.market.create.sportsExistingFailedCount(failedCount)}
              </p>
            )}
            {typeof createdCount === "number" && createdCount === 0 && typeof failedCount === "number" && failedCount > 0 && (
              <p className="text-sm text-(--text-secondary)">
                {t.market.create.sportsNoNewMarketsCreated}
              </p>
            )}
          </div>
        )}
        <button
          onClick={handlePrimaryAction}
          className="px-6 py-2.5 rounded-lg bg-(--accent) text-(--text-inverse) font-medium hover:opacity-90 transition-opacity"
        >
          {pendingIndexing
            ? (t.market.create.viewMyMarkets || "View my markets")
            : (t.market.create.goToMarketDetail || "Go to Market Detail")}
        </button>
      </div>
    );
  };

  // ============== 通用市场渲染函数 ==============

  // 渲染问题输入步骤
  const renderGeneralQuestionStep = () => {
    // crypto 表单直接触发 AI 补全时，显示加载态而非空白表单
    if (isGeneratingAI) {
      return (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {t.market.create.generating}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {marketQuestion}
          </p>
        </div>
      );
    }
    return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => resetForm()}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.enterYourQuestion}
        </h3>
      </div>

      <div>
        <textarea
          value={marketQuestion}
          onChange={(e) => setMarketQuestion(e.target.value)}
          placeholder={t.market.create.enterMarketQuestion}
          maxLength={200}
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none"
        />
        <p className="text-sm text-[var(--text-tertiary)] mt-2">
          {t.market.create.charactersRemaining(200 - marketQuestion.length, 200)}
        </p>
      </div>

      {/* 提示信息 */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
        <AlertCircle className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[var(--accent)]">
          {t.market.create.aiHint}
        </p>
      </div>

      {aiError && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{aiError}</p>
        </div>
      )}

      {/* 按钮 */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => resetForm()}
          className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={handleGenerateMarketDetails}
          disabled={!marketQuestion.trim() || isGeneratingAI}
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGeneratingAI ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.market.create.generating}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t.market.create.generateMarketDetails}
            </>
          )}
        </button>
      </div>
    </div>
    );
  };

  // 渲染 AI 生成详情编辑步骤
  const renderGeneralDetailsStep = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStep("general_question")}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.reviewMarketDetails}
        </h3>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.create.marketTitle}
        </label>
        <input
          type="text"
          value={aiGeneratedTitle}
          onChange={(e) => setAiGeneratedTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* End Date */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.create.endDate}
        </label>
        <DatePicker
          value={endDate ? dayjs(endDate) : null}
          onChange={(date) => setEndDate(date ? date.format('YYYY-MM-DD') : '')}
          className="w-full"
          placeholder={t.market.create.endDate}
          style={{ borderRadius: '0.5rem', padding: '0.625rem 1rem' }}
        />
      </div>

      {/* Rules */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.rules}
        </label>
        <textarea
          value={aiGeneratedRules}
          onChange={(e) => setAiGeneratedRules(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
        />
      </div>

      {/* AI 生成提示 */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-500">
            {t.market.create.aiGeneratedNote}
          </p>
          <p className="text-xs text-green-400 mt-1">
            {t.market.create.aiGeneratedEditHint}
          </p>
        </div>
      </div>

      {aiError && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{aiError}</p>
        </div>
      )}

      {/* 按钮 */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => setStep("general_question")}
          className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={handleAIReview}
          disabled={
            !aiGeneratedTitle || !endDate || !aiGeneratedRules || isReviewingAI
          }
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isReviewingAI ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.market.create.reviewing}
            </>
          ) : (
            t.market.common.next
          )}
        </button>
      </div>
    </div>
  );

  // 渲染预览确认步骤
  const renderGeneralPreviewStep = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setSubmitError(null); setStep("general_details"); }}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.previewAndCreate}
        </h3>
      </div>

      {/* 预览卡片 */}
      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
        <div className="flex gap-4">
          {/* 图片 */}
          {marketImage && (
            <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border-2 border-dashed border-[var(--accent)]">
              <img
                src={marketImage}
                alt="Market"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[var(--text-primary)] line-clamp-2">
              {aiGeneratedTitle}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {t.market.create.createdBy}{" "}
              <span className="underline">
                {backendUser?.displayName || "You"}
              </span>{" "}
              {t.market.create.withOpinionAI}
            </p>

            {/* YES/NO 按钮 */}
            <div className="flex gap-2 mt-4">
              <button className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold bg-[rgba(0,255,0,0.15)] text-[var(--green)] hover:bg-[rgba(0,255,0,0.25)] transition-colors text-center">
                Yes 50¢
              </button>
              <button className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold bg-[rgba(255,71,87,0.15)] text-[var(--red)] hover:bg-[rgba(255,71,87,0.25)] transition-colors text-center">
                No 50¢
              </button>
            </div>

            <div className="mt-3 space-y-1 text-sm">
              <p className="text-[var(--text-secondary)]">
                {t.market.create.endDate}:{" "}
                <span className="text-[var(--accent)]">{endDate}</span>
              </p>
              <p className="text-[var(--text-secondary)]">
                {t.market.create.category}:{" "}
                <span className="text-[var(--accent)]">
                  {categories.find((c) => c.slug === generalCategory)?.label ||
                    generalCategory}
                </span>
              </p>
              <p className="text-[var(--text-secondary)]">
                {t.market.create.selectedTradingToken}:{" "}
                <span className="text-[var(--text-tertiary)]">
                  {t.market.create.notProvided}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.rules}:
        </h4>
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
          <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
            {aiGeneratedRules}
          </p>
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-500">{t.market.create.creationFailed}</p>
            <p className="text-xs text-red-400 mt-1 break-words">
              {submitError}
            </p>
          </div>
        </div>
      )}

      {/* 按钮 */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => setStep("general_details")}
          className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={handleSubmitGeneralMarket}
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.market.create.creating}
            </>
          ) : (
            t.market.create.createMarketButton
          )}
        </button>
      </div>
    </div>
  );

  // ============== Crypto 表单相关 ==============

  // 将 API 数据转为 {value, label} 格式（API 返回空时降级到内置默认值）
  const DEFAULT_COINS = useMemo(() => [
    { value: "BTC", label: "Bitcoin (BTC)" },
    { value: "ETH", label: "Ethereum (ETH)" },
    { value: "USDT", label: "Tether (USDT)" },
    { value: "BNB", label: "BNB (BNB)" },
    { value: "SOL", label: "Solana (SOL)" },
    { value: "XRP", label: "Ripple (XRP)" },
    { value: "DOGE", label: "Dogecoin (DOGE)" },
    { value: "ADA", label: "Cardano (ADA)" },
    { value: "AVAX", label: "Avalanche (AVAX)" },
    { value: "LINK", label: "Chainlink (LINK)" },
  ], []);

  const DEFAULT_EXCHANGES = useMemo(() => [
    { value: "binance", label: "Binance" },
    { value: "coinbase", label: "Coinbase" },
    { value: "okx", label: "OKX" },
    { value: "bybit", label: "Bybit" },
    { value: "huobi", label: "Huobi" },
    { value: "kraken", label: "Kraken" },
    { value: "gate", label: "Gate.io" },
    { value: "kucoin", label: "KuCoin" },
  ], []);

  const cryptoCoins = useMemo(() => {
    const src = cryptoCoinsData.length > 0 ? cryptoCoinsData : DEFAULT_COINS.map(c => ({ symbol: c.value, name: c.label.split(' (')[0] }));
    return src.map(c => ({ value: c.symbol, label: `${c.name} (${c.symbol})` }));
  }, [cryptoCoinsData, DEFAULT_COINS]);

  const cryptoExchanges = useMemo(() => {
    const src = cryptoExchangesData.length > 0 ? cryptoExchangesData : DEFAULT_EXCHANGES.map(e => ({ id: e.value, name: e.label }));
    return src.map(e => ({ value: e.id, label: e.name }));
  }, [cryptoExchangesData, DEFAULT_EXCHANGES]);

  const cryptoMarketTypes: { value: CryptoMarketType; label: string; desc: string }[] = useMemo(() => [
    { value: "above", label: t.market.create.cryptoAbove, desc: t.market.create.cryptoAboveDesc },
    { value: "below", label: t.market.create.cryptoBelow, desc: t.market.create.cryptoBelowDesc },
    { value: "price-range", label: t.market.create.cryptoPriceRange, desc: t.market.create.cryptoPriceRangeDesc },
    { value: "hit-price", label: t.market.create.cryptoHitPrice, desc: t.market.create.cryptoHitPriceDesc },
    { value: "first-to-hit", label: t.market.create.cryptoFirstToHit, desc: t.market.create.cryptoFirstToHitDesc },
    { value: "custom", label: t.market.create.cryptoCustom, desc: t.market.create.cryptoCustomDesc },
  ], [t]);

  const cryptoTimeTypes = useMemo(() => [
    { value: "daily" as CryptoTimeType, label: t.market.create.cryptoTimeTypeDaily },
    { value: "weekly" as CryptoTimeType, label: t.market.create.cryptoTimeTypeWeekly },
    { value: "monthly" as CryptoTimeType, label: t.market.create.cryptoTimeTypeMonthly },
    { value: "yearly" as CryptoTimeType, label: t.market.create.cryptoTimeTypeYearly },
  ], [t]);

  // 根据时间类型构建人类可读日期字符串（用于 eventTitle）
  const buildDateLabel = useCallback((dateStr: string, timeType: CryptoTimeType): string => {
    if (!dateStr) return "";
    const d = dayjs(dateStr);
    switch (timeType) {
      case "daily":   return d.format("MMMM D");
      case "weekly":  return d.format("MMMM D");
      case "monthly": return d.format("MMMM YYYY");
      case "yearly":  return d.format("YYYY");
    }
  }, []);

  // 根据时间类型和日期字符串构建结算时间戳（毫秒）
  const buildResolutionTimestamp = useCallback((dateStr: string, timeType: CryptoTimeType): number => {
    if (!dateStr) return 0;
    const d = dayjs(dateStr);
    switch (timeType) {
      case "daily":   return d.endOf("day").valueOf();
      case "weekly":  return d.endOf("week").valueOf();
      case "monthly": return d.endOf("month").valueOf();
      case "yearly":  return d.endOf("year").valueOf();
    }
  }, []);

  // Crypto 表单提交：直接调用 /api/market/crypto
  const handleCryptoSubmit = useCallback(async () => {
    if (cryptoMarketType === "custom") {
      setGeneralCategory("crypto");
      setIsGeneralFlow(true);
      setMarketQuestion("");
      setStep("general_question");
      return;
    }

    // 获取 coin 元数据
    const coinData = cryptoCoinsData.find(c => c.symbol === cryptoCoin)
      ?? DEFAULT_COINS.map(c => ({ symbol: c.value, name: c.label.split(' (')[0], icon: undefined as string | undefined })).find(c => c.symbol === cryptoCoin);
    const coinName = coinData?.name || cryptoCoin;
    const coinIcon = (cryptoCoinsData.find(c => c.symbol === cryptoCoin) as (CryptoCoin & { icon?: string }) | undefined)?.icon;

    const dateLabel = buildDateLabel(cryptoDate, cryptoTimeType);

    // 构建 eventTitle 和 eventType
    let eventTitle = "";
    let eventType = "";
    switch (cryptoMarketType) {
      case "above":
        eventTitle = `${coinName} above ___ on ${dateLabel}?`;
        eventType = "ABOVE";
        break;
      case "below":
        eventTitle = `${coinName} below ___ on ${dateLabel}?`;
        eventType = "BELOW";
        break;
      case "price-range":
        eventTitle = `${coinName} price on ${dateLabel}?`;
        eventType = "PRICE_RANGE";
        break;
      case "hit-price":
        eventType = "HIT_PRICE";
        eventTitle = cryptoTimeType === "monthly"
          ? `What price will ${coinName} hit in ${dateLabel}?`
          : `What price will ${coinName} hit on ${dateLabel}?`;
        break;
      case "first-to-hit":
        eventType = "FIRST_TO_HIT";
        eventTitle = `Will ${coinName} hit these prices first?`;
        break;
    }

    // 构建 markets 数组
    type CryptoMarketItem = { question: string; marketValue?: number; targetRule?: string; outcomes?: string[] };
    let markets: CryptoMarketItem[] = [];
    switch (cryptoMarketType) {
      case "above":
        markets = cryptoTargetPrices
          .filter(p => p.trim())
          .map(p => ({ question: p.trim(), marketValue: parseFloat(p), targetRule: `GT:${p.trim()}` }));
        break;
      case "below":
        markets = cryptoTargetPrices
          .filter(p => p.trim())
          .map(p => ({ question: p.trim(), marketValue: parseFloat(p), targetRule: `LT:${p.trim()}` }));
        break;
      case "price-range":
        markets = cryptoRanges
          .filter(r =>
            r.direction === "above" ? r.low.trim() !== "" :
            r.direction === "below" ? r.high.trim() !== "" :
            (r.low.trim() !== "" && r.high.trim() !== "")
          )
          .map(r => {
            if (r.direction === "above") {
              return { question: r.low.trim(), marketValue: parseFloat(r.low), targetRule: `GT:${r.low.trim()}` };
            } else if (r.direction === "below") {
              return { question: r.high.trim(), marketValue: parseFloat(r.high), targetRule: `LT:${r.high.trim()}` };
            }
            return { question: r.low.trim(), marketValue: parseFloat(r.low), targetRule: `RANGE:${r.low.trim()},${r.high.trim()}` };
          });
        break;
      case "hit-price":
        markets = cryptoHitTargets
          .filter(p => p.trim())
          .map(p => ({ question: p.trim(), marketValue: parseFloat(p), targetRule: `FIRST_HIT:${p.trim()}` }));
        break;
      case "first-to-hit":
        markets = cryptoFirstToHits
          .filter(r => r.priceA.trim() && r.priceB.trim())
          .map(r => ({
            question: r.priceA.trim(),
            marketValue: parseFloat(r.priceA),
            targetRule: `FIRST_HIT:${r.priceA.trim()},${r.priceB.trim()}`,
            outcomes: [r.priceA.trim(), r.priceB.trim()],
          }));
        break;
    }

    // 过滤掉与已有市场重复的（按 marketValue 或 question 匹配）
    // DRAFT/DEPLOYING/DEPLOY_FAILED 状态的市场视为未部署，不过滤
    if (cryptoEventExistingMarkets.length > 0) {
      const deployedMarkets = cryptoEventExistingMarkets.filter(isDeployedMarket);
      const existingValues = new Set(
        deployedMarkets.map((m) => m.marketValue != null ? String(m.marketValue) : (m.question || "").trim().toLowerCase()).filter(Boolean)
      );
      markets = markets.filter((m) => {
        const mv = m.marketValue != null ? String(m.marketValue) : "";
        const q = (m.question || "").trim().toLowerCase();
        return !(mv && existingValues.has(mv)) && !(q && existingValues.has(q));
      });
    }

    if (markets.length === 0) {
      toast.error(t.market.create.pleaseAddAtLeastOneMarket);
      return;
    }

    const selectedCoinData = cryptoCoinsData.find(c => c.symbol === cryptoCoin) as (CryptoCoin & { slug?: string }) | undefined;
    const commonResolutionDate = selectedCryptoEvent
      ? normalizeTimestampValue(selectedCryptoEvent.commonResolutionDate)
      : buildResolutionTimestamp(cryptoDate, cryptoTimeType);
    const coinSlug = selectedCoinData?.slug
      ?? coinName.toLowerCase().replace(/\s+/g, '-');
    const marketTypeSlug = cryptoMarketType; // "above" | "below" | "price-range" | "hit-price" | "first-to-hit"
    const tagsSlug = selectedCryptoEvent?.tagsSlug?.length
      ? selectedCryptoEvent.tagsSlug
      : ["crypto", coinSlug, cryptoTimeType, marketTypeSlug].filter(Boolean);
    const parsedCoinId = selectedCryptoEvent
      ? (!Number.isNaN(Number(selectedCryptoEvent.coinId)) ? Number(selectedCryptoEvent.coinId) : undefined)
      : (selectedCoinData?.id != null && !Number.isNaN(Number(selectedCoinData.id)) ? Number(selectedCoinData.id) : undefined);
    const userAddress = backendUser?.smartAccountAddress || smartAccountAddress || "";

    if (!userAddress) {
      toast.error(t.market.common.connectWalletFirst);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setStep("processing");
    setProcessingStep(t.market.create.creating || "Creating market...");
    trackCreateSubmit("crypto", markets.length);

    try {
      // 单步：调用 To-B 控制器 crypto 分支（替换原 createCryptoMarket →
      // confirmMarkets → ensureMarketCreationBalance → batchInitializeMarkets 链路）
      const tobReq: TobUmaMarketCreateReq = {
        betId: newBetId(),
        type: "crypto",
        betAmount: getDefaultCreateBetAmount(),
        eventTitle: selectedCryptoEvent ? selectedCryptoEvent.eventTitle : eventTitle,
        eventType: selectedCryptoEvent ? selectedCryptoEvent.eventType : eventType,
        commonResolutionDate: commonResolutionDate || undefined,
        coinId: parsedCoinId !== undefined ? String(parsedCoinId) : undefined,
        coinSymbol: cryptoCoin,
        image: selectedCryptoEvent ? (selectedCryptoEvent.image || coinIcon) : coinIcon,
        tagsSlug,
        cryptoMarkets: markets.map((m) => ({
          question: m.question,
          marketValue: m.marketValue !== undefined ? String(m.marketValue) : undefined,
          targetRule: m.targetRule,
          outcomes: m.outcomes,
        })),
      };
      const tobResp = await tobApi.createUmaMarket(tobReq);

      const cryptoSlug = tobResp.slug || "";

      let indexingReady = true;
      if (cryptoSlug) {
        setProcessingStep(t.market.common.verifyingMarket);
        indexingReady = await pollForMarkets(cryptoSlug);
      }

      trackCreateSuccess("crypto", markets.length, cryptoSlug || undefined, tobResp.eventId || "");
      toast.success(t.market.common.marketCreatedSuccess);
      setResult({
        // 详情页优先用 slug，没有再回落 eventId
        slug: cryptoSlug,
        marketId: tobResp.eventId || tobResp.marketIds?.[0] || "",
        pendingIndexing: !!cryptoSlug && !indexingReady,
      } as any);
      setStep("success");
    } catch (err: any) {
      console.error("[CreateMarket] Crypto 创建失败:", err);
      trackCreateFailed("crypto", getCreateErrorReason(err));
      toast.error(err.message || t.market.common.createMarketFailed);
      setSubmitError(err.message || t.market.common.createMarketFailed);
      setStep("crypto_form");
    } finally {
      setIsSubmitting(false);
      setProcessingStep("");
    }
  }, [
    cryptoMarketType, cryptoCoin, cryptoDate, cryptoTimeType, cryptoExchange,
    cryptoTargetPrices, cryptoRanges, cryptoHitTargets, cryptoFirstToHits, cryptoEventExistingMarkets,
    cryptoCoinsData, DEFAULT_COINS, buildDateLabel, buildResolutionTimestamp,
    smartAccountAddress, backendUser, batchInitializeMarkets, ensureMarketCreationBalance,
    pollForMarkets, toast, t,
    trackCreateSubmit, trackCreateSuccess, trackCreateFailed, getCreateErrorReason,
  ]);

  // ============== Batch Event & Markets 处理函数 ==============

  // 事件搜索 debounce
  const handleEventTitleSearch = useCallback((query: string) => {
    setBatchEventTitle(query);
    setSelectedEvent(null); // 用户修改输入时清除已选事件
    setBatchEventId(null);
    setBatchEventSlug("");
    setEventCheckResult(null);

    if (eventSearchTimerRef.current) clearTimeout(eventSearchTimerRef.current);
    if (!query.trim()) {
      setEventSearchResults([]);
      setIsSearchingEvents(false);
      setShowEventDropdown(false);
      return;
    }

    setIsSearchingEvents(true);
    setShowEventDropdown(true);
    eventSearchTimerRef.current = setTimeout(async () => {
      try {
        const resp = await getEvents({ q: query.trim(), order: '-volume', limit: 20, active: true, tag_slug: selectedCategory?.slug });
        setEventSearchResults(resp.events || []);
      } catch (error) {
        console.error('[CreateMarket] Event search failed:', error);
        setEventSearchResults([]);
      } finally {
        setIsSearchingEvents(false);
      }
    }, 400);
  }, []);

  // 选择搜索结果中的事件
  const handleSelectEventFromSearch = useCallback((event: EventSummary) => {
    setSelectedEvent(event);
    setExistingMarketsCollapsed(true);
    setBatchEventTitle(event.title);
    setBatchEventId(event.id);
    setBatchEventSlug(event.slug || "");
    setBatchEventDescription(event.description || "");
    // 兼容后端可能返回 endDate 或 endTime，同时兼容秒/毫秒两种单位
    const rawEndTime = Number(event.endDate ?? event.endTime);
    if (typeof rawEndTime === "number" && rawEndTime > 0) {
      const ms = rawEndTime > 10_000_000_000 ? rawEndTime : rawEndTime * 1000;
      setBatchResolutionDate(new Date(ms).toISOString().split("T")[0]);
    }
    // 设置 tags
    if (event.tags && event.tags.length > 0) {
      setBatchTags(event.tags.map(t => ({ name: t.label, slug: t.slug })));
    }
    setShowEventDropdown(false);
    setEventCheckResult("found");
  }, []);

  // 点击外部关闭事件搜索下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eventSearchRef.current && !eventSearchRef.current.contains(e.target as Node)) {
        setShowEventDropdown(false);
      }
    };
    if (showEventDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEventDropdown]);

  // 点击外部关闭 tag 下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    if (tagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tagDropdownOpen]);

  // Step 1 → Step 2: 进入第二步
  const handleEventInfoNext = useCallback(async () => {
    if (!batchEventTitle.trim()) {
      toast.error(t.market.create.pleaseEnterEventTitle);
      return;
    }

    // 如果用户没有选择事件，调用 eventSupplement 获取 AI 优化信息
    if (!selectedEvent) {
      setIsCheckingEvent(true);
      try {
        const supplementResult = await eventSupplement({ event_title: batchEventTitle.trim() });
        setBatchEventTitle(supplementResult.event_title);
        setBatchEventDescription(supplementResult.event_desc);
        if (supplementResult.resolution_time) {
          setBatchResolutionDate(timestampToDateString(supplementResult.resolution_time));
        }
        setEventCheckResult("not_found");
      } catch (err: any) {
        console.error("[CreateMarket] Event supplement failed:", err);
        toast.error(err.message || "Event supplement failed");
        setIsCheckingEvent(false);
        return; // API 调用失败时阻止进入下一步
      } finally {
        setIsCheckingEvent(false);
      }
    }

    // 加载 tags
    try {
      const tags = await getMarketTags();
      setMarketTagsList(tags);
    } catch (err) {
      console.error("[CreateMarket] Load tags failed:", err);
    }

    setBatchCurrentStep(1);
    setStep("batch_markets");
  }, [batchEventTitle, selectedEvent, toast, t]);

  // 添加一个市场关键词输入框
  const handleAddKeywordInput = useCallback(() => {
    setMarketKeywords(prev => [...prev, ""]);
  }, []);

  // 更新关键词
  const handleUpdateKeyword = useCallback((index: number, value: string) => {
    setMarketKeywords(prev => prev.map((k, i) => i === index ? value : k));
  }, []);

  // 删除关键词
  const handleRemoveKeyword = useCallback((index: number) => {
    setMarketKeywords(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 生成市场（调用 /v1/event/market/supplement）
  const handleGenerateMarkets = useCallback(async () => {
    const keywords = marketKeywords.filter(k => k.trim());
    if (keywords.length === 0) {
      toast.error(t.market.create.pleaseAddAtLeastOneMarket);
      return;
    }

    setIsGeneratingBatch(true);
    try {
      const resolutionTimeISO = batchResolutionDate
        ? new Date(batchResolutionDate + 'T23:59:59Z').toISOString()
        : new Date().toISOString();

      const result = await eventMarketSupplement({
        event_title: batchEventTitle,
        event_desc: batchEventDescription,
        resolution_time: resolutionTimeISO,
        markets: keywords.map((kw, idx) => ({ id: idx, keyword: kw })),
      });

      if (result.markets && result.markets.length > 0) {
        const newMarkets: BatchMarketItem[] = result.markets
          .filter((item) => {
            // 过滤掉与已有事件市场重复的问题
            const q = (item.title || "").trim().toLowerCase();
            return !existingEventMarketQuestions.has(q);
          })
          .map((item) => ({
            id: `gen-${Date.now()}-${item.id}`,
            keyword: item.keyword,
            question: item.title,
            description: item.desc,
          }));
        setBatchMarkets(prev => [...prev, ...newMarkets]);
        setMarketKeywords([""]); // 清空关键词输入，保持输入框显示
      }
    } catch (err: any) {
      console.error("[CreateMarket] Market supplement failed:", err);
      toast.error(err.message || "Market generation failed");
    } finally {
      setIsGeneratingBatch(false);
    }
  }, [marketKeywords, batchEventTitle, batchEventDescription, batchResolutionDate, existingEventMarketQuestions, toast, t]);

  // 提交审核记录（新建 or 更新）
  const handleSubmitReview = useCallback(async () => {
    if (batchMarkets.length === 0) {
      toast.error(t.market.create.pleaseAddAtLeastOneMarket);
      return;
    }

    // 优先使用 walletAddress（真实钱包地址），而非 smartAccountAddress（智能合约地址）
    const userAddress = backendUser?.walletAddress || backendUser?.smartAccountAddress || smartAccountAddress || "";
    if (!userAddress) {
      toast.error(t.market.common.connectWalletFirst);
      return;
    }

    setIsReviewingEvent(true);
    setReviewError(null);

    try {
      const resolutionTimeISO = batchResolutionDate
        ? new Date(batchResolutionDate + 'T23:59:59Z').toISOString()
        : undefined;

      // 构建 input（= 原审核接口参数）
      const input: any = {
        markets: batchMarkets.map((m, idx) => ({
          id: idx,
          keyword: m.keyword,
          title: m.question,
          desc: m.description || "",
        })),
      };

      // 始终传入 event_title、event_desc、resolution_time（即使选了已有 event）
      if (batchEventId) {
        input.event_id = batchEventId;
      }
      if (batchEventTitle) input.event_title = batchEventTitle;
      if (batchEventDescription) input.event_desc = batchEventDescription;
      if (resolutionTimeISO) input.resolution_time = resolutionTimeISO;

      // 构建 metadata（额外数据，审核通过后回填用）
      const tagStrs = batchTags.length > 0
        ? marketTagsList
            .filter((tg: TagItem) => batchTags.some((bt: any) => bt.slug === tg.slug))
            .map((tg: TagItem) => tg.id)
            .filter(Boolean)
        : [];
      const categoryObj = categories.find((c: any) => c.slug === generalCategory);
      if (categoryObj?.id) tagStrs.push(categoryObj.id);

      const metadata: Record<string, any> = {
        generalCategory,
        image: marketImage || "",
        tagIds: tagStrs,
        tagSlugs: batchTags.map((bt: any) => bt.slug),
        tagNames: batchTags.map((bt: any) => bt.name),
        marketKeywords: Object.fromEntries(batchMarkets.map((m, idx) => [String(idx), m.keyword])),
      };

      if (reviewRecordMode) {
        // 已有审核记录 → 调用更新接口
        await updateReviewRecord({ id: reviewRecordMode.id, input, metadata });
      } else {
        // 首次提交 → 调用创建接口
        await createReviewRecord({ wallet: userAddress, input, metadata });
      }

      toast.success(t.market.create.reviewSubmitted);
      handleClose();
      // 提交审核后引导用户到 /pna 页面的审核列表查看
      router.push('/pna');
    } catch (err: any) {
      console.error("[CreateMarket] Submit review failed:", err);
      setReviewError(err.message || "Submit review failed");
      toast.error(err.message || "Submit review failed");
    } finally {
      setIsReviewingEvent(false);
    }
  }, [batchMarkets, batchEventId, batchEventTitle, batchEventDescription, batchResolutionDate, batchTags, marketTagsList, categories, generalCategory, marketImage, backendUser, smartAccountAddress, toast, t, handleClose, reviewRecordMode, router]);

  // 审核通过后创建市场 (PUT /api/market)
  const handleCreateMarketV2 = useCallback(async () => {
    const userAddress = backendUser?.smartAccountAddress || smartAccountAddress || "";
    if (!userAddress) {
      toast.error(t.market.common.connectWalletFirst);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setStep("processing");
    const reviewFlow = reviewRecordMode ? "review_v2" : "batch_v2";

    try {
      setProcessingStep(t.market.create.creatingMarket);

      const resolutionDateMs = batchResolutionDate
        ? new Date(batchResolutionDate + 'T23:59:59Z').getTime()
        : Date.now();

      let tagStrs = batchTags.length > 0
        ? marketTagsList
            .filter(t => batchTags.some(bt => bt.slug === t.slug))
            .map(t => t.id)
            .filter(Boolean)
        : [];
      // 审核模式下 marketTagsList 可能未加载，直接使用 metadata 中已有的 tagIds
      if (tagStrs.length === 0 && reviewRecordMode && (initialData?.reviewRecord?.metadata?.tagIds?.length ?? 0) > 0) {
        tagStrs = [...(initialData!.reviewRecord!.metadata.tagIds)];
      }
      // 未选 tag 时回退到当前 category 的 id
      const categoryObj = categories.find(c => c.slug === generalCategory);
      if (categoryObj?.id) tagStrs.push(categoryObj.id);
      const finalTags = tagStrs;

      // 单步：调用 To-B 控制器（替换原 createGeneralMarketV2 → confirmMarkets →
      // ensureMarketCreationBalance → batchInitializeMarkets 链路）
      const tobReq: TobUmaMarketCreateReq = {
        betId: newBetId(),
        type: "common",
        betAmount: getDefaultCreateBetAmount(),
        eventId: batchEventId != null ? String(batchEventId) : undefined,
        eventTitle: batchEventTitle,
        description: batchEventDescription || undefined,
        marketType: "YES_NO",
        tags: finalTags,
        outcomes: batchMarkets.map((m) => ({
          name: m.keyword,
          question: m.question,
          slug: m.keyword,
          description: m.description || "",
        })),
        image: marketImage || undefined,
        commonResolutionDate: resolutionDateMs,
      };
      const tobResp = await tobApi.createUmaMarket(tobReq);
      const eventSlug = batchEventSlug;

      // 标记审核记录已使用（fire-and-forget，不阻塞主流程）
      if (reviewRecordMode) {
        markReviewRecordUsed(reviewRecordMode.id, userAddress).catch((e) =>
          console.warn("[CreateMarket] markReviewRecordUsed failed (non-blocking):", e)
        );
      }

      // 后端返 slug 优先；否则回落念 form 自己的 eventSlug
      const resolvedEventSlug = tobResp.slug || eventSlug;

      let indexingReady = true;
      if (resolvedEventSlug) {
        setProcessingStep(t.market.common.verifyingMarket);
        indexingReady = await pollForMarkets(resolvedEventSlug);
      }

      trackCreateSuccess(reviewFlow, batchMarkets.length, resolvedEventSlug || undefined);
      toast.success(t.market.common.marketCreatedSuccess);
      setResult({
        marketId: tobResp.eventId || tobResp.marketIds?.[0] || "",
        slug: resolvedEventSlug,
        pendingIndexing: !!resolvedEventSlug && !indexingReady,
      } as any);
      setStep("success");
    } catch (err: any) {
      console.error("[CreateMarket] V2 market creation failed:", err);
      trackCreateFailed(reviewFlow, getCreateErrorReason(err));
      toast.error(err.message || t.market.common.createMarketFailed);
      setSubmitError(err.message || t.market.common.createMarketFailed);
      setStep("batch_markets");
    } finally {
      setIsSubmitting(false);
      setProcessingStep("");
    }
  }, [
    backendUser, smartAccountAddress, batchEventTitle, batchEventDescription,
    batchEventId, batchEventSlug, batchMarkets, batchResolutionDate, batchTags,
    marketTagsList, marketImage, batchInitializeMarkets, ensureMarketCreationBalance,
    pollForMarkets, toast, t, reviewRecordMode,
    trackCreateSubmit, trackCreateSuccess, trackCreateFailed, getCreateErrorReason,
  ]);

  // 审核记录模式下的提交：未修改 → 直接创建；已修改 → 重新审核
  const handleReviewEvent = useCallback(async () => {
    if (reviewRecordMode?.status === 'approved' && !isReviewFormDirty) {
      // 审核已通过且表单未改动 → 直接创建市场
      await handleCreateMarketV2();
    } else {
      // 首次提交 / 被拒绝后重新提交 / 表单已修改 → 提交审核
      await handleSubmitReview();
    }
  }, [reviewRecordMode, isReviewFormDirty, handleCreateMarketV2, handleSubmitReview]);

  // 批量生成市场：将每行文本转为 [Yes/No] Market 问题
  const handleBatchGenerate = useCallback(async () => {
    const lines = batchMarketInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    setIsGeneratingBatch(true);

    try {
      // 根据 event title 和每行 description 生成 market question
      const newMarkets: BatchMarketItem[] = lines.map((line, idx) => ({
        id: `batch-${Date.now()}-${idx}`,
        keyword: line,
        question: `${line} will be Next PM?`, // 默认模板，后面用 AI 优化
        description: line,
      }));

      // 尝试用 AI 为每个生成更好的问题
      const aiResults = await Promise.allSettled(
        lines.map((line) =>
          aiSupplementMarket({
            market_title: `${batchEventTitle}: ${line}`,
          })
        )
      );

      aiResults.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value.market_title) {
          newMarkets[idx].question = result.value.market_title;
          newMarkets[idx].description = result.value.market_desc || lines[idx];
          // 如果尚未设置统一结算日期，使用 AI 返回的第一个
          if (!batchResolutionDate && result.value.resolution_time) {
            setBatchResolutionDate(timestampToDateString(result.value.resolution_time));
          }
        }
      });

      setBatchMarkets((prev) => [...prev, ...newMarkets]);
      setBatchMarketInput(""); // 清空输入
    } catch (err) {
      console.error("[CreateMarket] Batch generate failed:", err);
      toast.error(t.market.create.aiGenerationFailed);
    } finally {
      setIsGeneratingBatch(false);
    }
  }, [batchMarketInput, batchEventTitle, batchResolutionDate, toast, t]);

  // 手动添加一个市场
  const handleAddMarketManually = useCallback(() => {
    setBatchMarkets((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        keyword: "",
        question: "",
        description: "",
      },
    ]);
  }, []);

  // 删除一个市场
  const handleRemoveBatchMarket = useCallback((id: string) => {
    setBatchMarkets((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // 更新市场问题
  const handleUpdateBatchMarketQuestion = useCallback(
    (id: string, question: string) => {
      setBatchMarkets((prev) =>
        prev.map((m) => (m.id === id ? { ...m, question } : m))
      );
    },
    []
  );

  // 加载 tags
  useEffect(() => {
    if (step !== "global_settings") return;
    setIsLoadingTags(true);
    getTagTree(undefined, false)
      .then((tags) => {
        setAvailableTags(tags);
      })
      .catch(() => {})
      .finally(() => setIsLoadingTags(false));
  }, [step]);

  // 防抖搜索 tags（调用 API）
  const handleTagSearch = useCallback((label: string) => {
    setTagSearchQuery(label);
    if (tagSearchTimerRef.current) clearTimeout(tagSearchTimerRef.current);
    if (!label.trim()) {
      // 空搜索 → 加载全量
      getMarketTags().then(tags => setMarketTagsList(tags)).catch(() => {});
      return;
    }
    setIsSearchingTags(true);
    tagSearchTimerRef.current = setTimeout(async () => {
      try {
        const tags = await getMarketTags(label.trim());
        setMarketTagsList(tags);
      } catch (err) {
        console.error("[CreateMarket] Tag search failed:", err);
      } finally {
        setIsSearchingTags(false);
      }
    }, 300);
  }, []);

  // 添加 tag
  const handleAddTag = useCallback(
    (tag: { name: string; slug: string }) => {
      if (batchTags.some((t) => t.slug === tag.slug)) return;
      setBatchTags((prev) => [...prev, tag]);
      setTagSearchQuery("");
    },
    [batchTags]
  );

  // 移除 tag
  const handleRemoveTag = useCallback((slug: string) => {
    setBatchTags((prev) => prev.filter((t) => t.slug !== slug));
  }, []);

  // 创建新 tag
  const handleCreateTag = useCallback(
    (name: string) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      handleAddTag({ name, slug });
    },
    [handleAddTag]
  );

  // 过滤后的 tags
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return availableTags;
    const q = tagSearchQuery.toLowerCase();
    return availableTags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
    );
  }, [availableTags, tagSearchQuery]);

  // 提交批量创建
  const handleSubmitBatchMarkets = useCallback(async () => {
    const userAddress =
      backendUser?.smartAccountAddress || smartAccountAddress || "";
    if (!userAddress) {
      toast.error(t.market.common.connectWalletFirst);
      return;
    }

    if (batchMarkets.length === 0) {
      toast.error(t.market.create.pleaseAddAtLeastOneMarket);
      return;
    }

    if (!batchResolutionDate) {
      toast.error(t.market.create.pleaseSelectResolutionDate);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setStep("processing");

    try {
      const tagSlugs =
        batchTags.length > 0
          ? batchTags.map((t) => t.slug)
          : [generalCategory];

      const resolutionDateMs = batchResolutionDate
        ? new Date(batchResolutionDate + "T23:59:59Z").getTime()
        : undefined;

      // 单步：调用 To-B 控制器 common 分支（替换原 N×createGeneralMarket →
      // confirmMarkets → ensureMarketCreationBalance → batchInitializeMarkets 链路；
      // 一次请求把整个 batchMarkets 作为 outcomes 传给后端）
      setProcessingStep(t.market.create.creatingMarket);
      const tobReq: TobUmaMarketCreateReq = {
        betId: newBetId(),
        type: "common",
        betAmount: getDefaultCreateBetAmount(),
        eventId: batchEventId != null ? String(batchEventId) : undefined,
        eventTitle: batchEventTitle,
        description: batchEventDescription || undefined,
        marketType: "BINARY",
        tags: tagSlugs.filter(Boolean) as string[],
        outcomes: batchMarkets.map((m) => ({
          name: m.question,
          question: m.question,
          slug: (m.keyword || m.question).toString(),
          description: m.description || batchEventDescription || "",
        })),
        image: marketImage || undefined,
        commonResolutionDate: resolutionDateMs,
      };
      const tobResp = await tobApi.createUmaMarket(tobReq);
      // 后端返 slug 优先；否则回落 form 里的 batchEventSlug
      const lastEventSlug = tobResp.slug || batchEventSlug;

      let indexingReady = true;
      if (lastEventSlug) {
        setProcessingStep(t.market.common.verifyingMarket);
        indexingReady = await pollForMarkets(lastEventSlug);
      }

      trackCreateSuccess("batch", batchMarkets.length, lastEventSlug || undefined);
      toast.success(t.market.common.marketCreatedSuccess);
      setResult({
        marketId: tobResp.eventId || tobResp.marketIds?.[0] || "",
        slug: lastEventSlug,
        pendingIndexing: !!lastEventSlug && !indexingReady,
      } as any);
      setStep("success");
    } catch (err: any) {
      console.error("[CreateMarket] Batch creation failed:", err);
      trackCreateFailed("batch", getCreateErrorReason(err));
      toast.error(err.message || t.market.common.createMarketFailed);
      setSubmitError(err.message || t.market.common.createMarketFailed);
      setStep("event_confirm");
    } finally {
      setIsSubmitting(false);
      setProcessingStep("");
    }
  }, [
    backendUser,
    smartAccountAddress,
    batchEventTitle,
    batchEventDescription,
    batchEventId,
    batchEventSlug,
    batchMarkets,
    batchResolutionDate,
    batchTags,
    generalCategory,
    marketImage,
    batchInitializeMarkets,
    ensureMarketCreationBalance,
    pollForMarkets,
    toast,
    t,
    trackCreateSubmit,
    trackCreateSuccess,
    trackCreateFailed,
    getCreateErrorReason,
  ]);

  // Crypto 表单有效性检查
  const isCryptoFormValid = useMemo(() => {
    if (cryptoMarketType === "custom") return true;
    // 选了已有事件时 coin/date 已锁定，无需单独检测
    if (!selectedCryptoEvent) {
      if (!cryptoCoin) return false;
      if (!cryptoDate) return false;
    }
    switch (cryptoMarketType) {
      case "above":
      case "below":
        return cryptoTargetPrices.some(p => p.trim() !== "");
      case "price-range":
        return cryptoRanges.some(r =>
          r.direction === "above" ? r.low.trim() !== "" :
          r.direction === "below" ? r.high.trim() !== "" :
          (r.low.trim() !== "" && r.high.trim() !== "")
        );
      case "hit-price":
        return cryptoHitTargets.some(p => p.trim() !== "");
      case "first-to-hit":
        return cryptoFirstToHits.some(r => r.priceA.trim() !== "" && r.priceB.trim() !== "");
      default: return false;
    }
  }, [selectedCryptoEvent, cryptoMarketType, cryptoCoin, cryptoDate, cryptoTargetPrices, cryptoRanges, cryptoHitTargets, cryptoFirstToHits]);

  // 渲染 Crypto 选择已有事件步骤
  const renderCryptoSelectEventStep = () => (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">
      {/* 标题行 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setSubmitError(null); resetForm(); }}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.cryptoSelectEventTitle}
        </h3>
      </div>

      {/* 描述 */}
      <p className="text-sm text-[var(--text-secondary)]">
        {t.market.create.cryptoSelectEventDesc}
      </p>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
        {isSearchingCryptoEvents && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] animate-spin" />
        )}
        <input
          type="text"
          value={cryptoEventSearchQuery}
          onChange={(e) => handleCryptoEventSearch(e.target.value)}
          placeholder={t.market.create.cryptoSearchEventPlaceholder}
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
        />
        {cryptoEventSearchQuery && (
          <button
            onClick={() => { setCryptoEventSearchQuery(""); handleCryptoEventSearch(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 事件列表 */}
      {isSearchingCryptoEvents ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-secondary)]" />
        </div>
      ) : cryptoEventResults.length > 0 ? (
        <div className="space-y-2">
          {cryptoEventResults.map((event) => {
            const isSelected = selectedCryptoEvent?.eventId === event.eventId;
            return (
              <button
                key={event.eventId}
                onClick={() => handleSelectCryptoEvent(event)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-hover)]"
                }`}
              >
                {event.image ? (
                  <img src={event.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg-card)] flex items-center justify-center flex-shrink-0">
                    <Search className="w-4 h-4 text-[var(--text-tertiary)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{event.eventTitle}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {event.eventType} · {formatTimestampDateOnly(event.commonResolutionDate) || "-"}
                  </p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-sm text-[var(--text-tertiary)]">
          {t.market.create.cryptoNoEventsFound}
        </div>
      )}

      {/* 底部按钮：Skip + Next */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
        <button
          onClick={() => {
            setSelectedCryptoEvent(null);
            setCryptoMarketType("above");
            setCryptoTargetPrices([""]);
            setCryptoRanges([{ low: "", high: "", direction: "range" }]);
            setCryptoHitTargets([""]);
            setCryptoFirstToHits([{ priceA: "", priceB: "" }]);
            setCryptoDate("");
            setCryptoCoin("");
            setStep("crypto_form");
          }}
          className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors text-sm font-medium"
        >
          {t.market.create.cryptoSkipCreateNew}
        </button>
        <button
          onClick={() => selectedCryptoEvent && setStep("crypto_form")}
          disabled={!selectedCryptoEvent}
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          {t.market.common.next}
        </button>
      </div>
    </div>
  );

  // 渲染 Crypto 表单
  const renderCryptoFormStep = () => (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setSubmitError(null);
            if (selectedCryptoEvent) {
              setStep("crypto_select_event");
            } else {
              resetForm();
            }
          }}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.createCryptoMarket}
        </h3>
      </div>

      {/* 已选事件只读显示 */}
      {selectedCryptoEvent && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30">
          <Check className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-0.5">{t.market.create.cryptoEventTitleDisplay}</p>
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{selectedCryptoEvent.eventTitle}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {t.market.create.cryptoResolutionDate}: {formatTimestampDateOnly(selectedCryptoEvent.commonResolutionDate) || "-"}
            </p>
          </div>
        </div>
      )}

      {/* 市场类型选择：已选事件时只显示当前锁定类型 */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.create.marketType} *
          {selectedCryptoEvent && <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">{t.market.create.cryptoEventLocked}</span>}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(selectedCryptoEvent
            ? cryptoMarketTypes.filter(opt => opt.value === cryptoMarketType)
            : cryptoMarketTypes
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => !selectedCryptoEvent && setCryptoMarketType(opt.value)}
              disabled={!!selectedCryptoEvent}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                cryptoMarketType === opt.value
                  ? "border-[var(--accent)] bg-[var(--accent)] shadow-md"
                  : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)]"
              } ${selectedCryptoEvent ? "opacity-80 cursor-default" : ""}`}
            >
              <div className={`text-sm font-medium ${cryptoMarketType === opt.value ? "text-black" : "text-[var(--text-primary)]"}`}>
                {opt.label}
              </div>
              <div className={`text-xs mt-0.5 ${cryptoMarketType === opt.value ? "text-black/70" : "text-[var(--text-tertiary)]"}`}>
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 已有市场（选择已有 crypto event 时显示，默认折叠） */}
      {selectedCryptoEvent && (isLoadingCryptoEventMarkets || cryptoEventExistingMarkets.length > 0) && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
          <button
            type="button"
            onClick={() => setCryptoExistingMarketsCollapsed((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {t.market.create.sportsConfigurator.existingMarkets}
              </span>
              {!isLoadingCryptoEventMarkets && (
                <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[10px] text-[var(--text-secondary)] font-medium">
                  {cryptoEventExistingMarkets.length}
                </span>
              )}
            </div>
            {isLoadingCryptoEventMarkets ? (
              <Loader2 className="w-4 h-4 text-[var(--text-tertiary)] animate-spin" />
            ) : (
              <ChevronDown
                className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${
                  cryptoExistingMarketsCollapsed ? "" : "rotate-180"
                }`}
              />
            )}
          </button>
          {!cryptoExistingMarketsCollapsed && !isLoadingCryptoEventMarkets && (
            <div className="px-4 pb-3 space-y-2 border-t border-[var(--border)] pt-3">
              {cryptoEventExistingMarkets.map((market) => (
                <div
                  key={market.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] opacity-70"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {market.question}
                    </p>
                    {market.groupItemTitle && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                        {market.groupItemTitle}
                      </p>
                    )}
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[10px] text-[var(--text-secondary)] shrink-0">
                    {t.market.create.sportsConfigurator.existingTag}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom 类型提示 */}
      {cryptoMarketType === "custom" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
          <AlertCircle className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--accent)]">{t.market.create.customCryptoHint}</p>
        </div>
      )}

      {/* 非 Custom 类型：公共字段 */}
      {cryptoMarketType !== "custom" && (
        <>
          {/* 行 1：币种下拉 + 时间类型下拉 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 币种：已选事件时显示只读标签 */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t.market.create.coin} *
                {selectedCryptoEvent && <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">{t.market.create.cryptoEventLocked}</span>}
              </label>
              {selectedCryptoEvent ? (
                <div className="px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm opacity-70">
                  {cryptoCoin || "—"}
                </div>
              ) : (
                <Combobox
                  value={cryptoCoin || undefined}
                  onChange={(val) => setCryptoCoin(val ?? "")}
                  onSearch={handleCoinSearch}
                  placeholder={t.market.create.selectCoin}
                  loading={cryptoCoinsLoading}
                  emptyText={t.market.create.noCoinsFound}
                  options={cryptoCoins.map(c => ({ value: c.value, label: c.label }))}
                />
              )}
            </div>

            {/* 时间类型：已选事件时隐藏 */}
            {!selectedCryptoEvent && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  {t.market.create.cryptoTimeType} *
                </label>
                <Select
                  value={cryptoTimeType}
                  onValueChange={(val) => { setCryptoTimeType(val as CryptoTimeType); setCryptoDate(""); }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cryptoTimeTypes.map(tt => (
                      <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* 行 2：日期选择器 + 交易所 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t.market.create.date} *
                {selectedCryptoEvent && <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">{t.market.create.cryptoEventLocked}</span>}
              </label>
              {selectedCryptoEvent ? (
                <div className="px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm opacity-70">
                  {cryptoDate || formatTimestampDateOnly(selectedCryptoEvent.commonResolutionDate) || "-"}
                </div>
              ) : (
                <DatePicker
                  key={cryptoTimeType}
                  picker={cryptoTimeType === "daily" ? "date" : cryptoTimeType === "weekly" ? "week" : cryptoTimeType === "monthly" ? "month" : "year"}
                  value={cryptoDate ? dayjs(cryptoDate) : null}
                  onChange={(date) => setCryptoDate(date ? date.format('YYYY-MM-DD') : '')}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  className="w-full"
                  placeholder={t.market.create.date}
                  style={{ borderRadius: '0.5rem', padding: '0.625rem 1rem' }}
                />
              )}
            </div>

            {/* <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t.market.create.exchangeOptional}
              </label>
              <Select
                value={cryptoExchange || undefined}
                onChange={(val: string | undefined) => setCryptoExchange(val ?? "")}
                allowClear
                placeholder={t.market.create.anyExchange}
                className="w-full"
                loading={cryptoExchangesData.length === 0}
                options={cryptoExchanges.map(ex => ({ value: ex.value, label: ex.label }))}
              />
            </div> */}
          </div>

          {/* ===== 动态字段 ===== */}

          {/* Above / Below：多个目标价格 */}
          {(cryptoMarketType === "above" || cryptoMarketType === "below") && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                {t.market.create.targetPrice} *
              </label>
              {cryptoTargetPrices.map((price, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    value={price}
                    onChange={(e) => {
                      const next = [...cryptoTargetPrices];
                      next[idx] = e.target.value;
                      setCryptoTargetPrices(next);
                    }}
                    placeholder={`${t.market.create.exampleTargetPrice} #${idx + 1}`}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  {cryptoTargetPrices.length > 1 && (
                    <button
                      onClick={() => setCryptoTargetPrices(cryptoTargetPrices.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCryptoTargetPrices([...cryptoTargetPrices, ""])}
                className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                {t.market.create.addTargetPrice}
              </button>
            </div>
          )}

          {/* Price Range：多个区间 */}
          {cryptoMarketType === "price-range" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                {t.market.create.priceRange} *
              </label>
              {cryptoRanges.map((range, idx) => (
                <div key={idx} className="space-y-1.5">
                  {/* 方向选择：> | < | Between */}
                  <div className="flex gap-1.5">
                    {(["above", "below", "range"] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => {
                          const next = [...cryptoRanges];
                          next[idx] = { ...next[idx], direction: dir };
                          setCryptoRanges(next);
                        }}
                        className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                          range.direction === dir
                            ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                            : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {dir === "above" ? t.market.create.directionAbove
                          : dir === "below" ? t.market.create.directionBelow
                          : t.market.create.directionRange}
                      </button>
                    ))}
                    {cryptoRanges.length > 1 && (
                      <button
                        onClick={() => setCryptoRanges(cryptoRanges.filter((_, i) => i !== idx))}
                        className="ml-auto p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {/* 输入区域：根据方向显示字段 */}
                  <div className="flex gap-2 items-center">
                    {(range.direction === "above" || range.direction === "range") && (
                      <input
                        type="number"
                        step="any"
                        value={range.low}
                        onChange={(e) => {
                          const next = [...cryptoRanges];
                          next[idx] = { ...next[idx], low: e.target.value };
                          setCryptoRanges(next);
                        }}
                        placeholder={range.direction === "above" ? t.market.create.pricePlaceholderAbove : t.market.create.rangeLowPlaceholder}
                        className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    )}
                    {range.direction === "range" && (
                      <span className="text-[var(--text-tertiary)] text-sm flex-shrink-0">—</span>
                    )}
                    {(range.direction === "below" || range.direction === "range") && (
                      <input
                        type="number"
                        step="any"
                        value={range.high}
                        onChange={(e) => {
                          const next = [...cryptoRanges];
                          next[idx] = { ...next[idx], high: e.target.value };
                          setCryptoRanges(next);
                        }}
                        placeholder={range.direction === "below" ? t.market.create.pricePlaceholderBelow : t.market.create.rangeHighPlaceholder}
                        className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setCryptoRanges([...cryptoRanges, { low: "", high: "", direction: "range" }])}
                className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                {t.market.create.addPriceRange}
              </button>
            </div>
          )}

          {/* Hit Price (target) */}
          {cryptoMarketType === "hit-price" && (
            <div className="space-y-2">
              {cryptoHitTargets.map((price, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    value={price}
                    onChange={(e) => {
                      const next = [...cryptoHitTargets];
                      next[idx] = e.target.value;
                      setCryptoHitTargets(next);
                    }}
                    placeholder={`${t.market.create.exampleTargetPrice} #${idx + 1}`}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  {cryptoHitTargets.length > 1 && (
                    <button
                      onClick={() => setCryptoHitTargets(cryptoHitTargets.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCryptoHitTargets([...cryptoHitTargets, ""])}
                className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                {t.market.create.addHitPrice}
              </button>
            </div>
          )}

          {/* First to Hit */}
          {cryptoMarketType === "first-to-hit" && (
            <div className="space-y-2">
              {cryptoFirstToHits.slice(0, 1).map((pair, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    value={pair.priceA}
                    onChange={(e) => {
                      const next = [...cryptoFirstToHits];
                      next[idx] = { ...next[idx], priceA: e.target.value };
                      setCryptoFirstToHits(next);
                    }}
                    placeholder={t.market.create.pricePlaceholderA}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <span className="text-[var(--text-secondary)] text-xs font-medium flex-shrink-0">or</span>
                  <input
                    type="number"
                    step="any"
                    value={pair.priceB}
                    onChange={(e) => {
                      const next = [...cryptoFirstToHits];
                      next[idx] = { ...next[idx], priceB: e.target.value };
                      setCryptoFirstToHits(next);
                    }}
                    placeholder={t.market.create.pricePlaceholderB}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 提交错误 */}
      {submitError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {submitError}
        </div>
      )}

      {/* 提交按钮 */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => resetForm()}
          className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={handleCryptoSubmit}
          disabled={!isCryptoFormValid || isSubmitting}
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{t.market.create.creating}</>
          ) : cryptoMarketType === "custom" ? (
            t.market.create.goToCustomForm
          ) : (
            <><Sparkles className="w-4 h-4" />{t.market.create.createMarketButton}</>
          )}
        </button>
      </div>
    </div>
  );

  // ============== Batch Event & Markets 渲染函数 ==============

  // 注：原来的 renderBatchStepIndicator（"1 事件信息 → 2 生成市场"两步进度条）
  // 已删除——只有 2 步的进度条性价比低，标题 + 返回按钮已经传达"我在第几步"
  // 的信息，删掉可省 60-80px 垂直空间，对移动端尤其重要。

  // Step 1: Event Info - 事件搜索输入（带下拉搜索 20 条 + 选择）
  const renderEventInfoStep = () => (
    <div className="space-y-5">

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => resetForm()}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.stepEventInfo}
        </h3>
      </div>

      {/* Event Title - 带搜索下拉 */}
      <div ref={eventSearchRef} className="relative">
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.create.eventTitle} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          {isSearchingEvents && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] animate-spin" />
          )}
          <input
            type="text"
            value={batchEventTitle}
            onChange={(e) => handleEventTitleSearch(e.target.value)}
            onFocus={() => { if (batchEventTitle.trim()) setShowEventDropdown(true); }}
            placeholder={t.market.create.eventTitlePlaceholder}
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
          />
          {batchEventTitle && (
            <button
              onClick={() => {
                setBatchEventTitle("");
                setSelectedEvent(null);
                setBatchEventId(null);
                setEventSearchResults([]);
                setShowEventDropdown(false);
                setEventCheckResult(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 搜索结果下拉（改为向上展开，避免遮挡底部区域） */}
        {showEventDropdown && batchEventTitle.trim() && (
          <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] shadow-xl z-[5000] max-h-[300px] overflow-y-auto">
            {isSearchingEvents ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-[var(--text-secondary)]" />
              </div>
            ) : eventSearchResults.length > 0 ? (
              <div className="p-1">
                {eventSearchResults.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => handleSelectEventFromSearch(event)}
                    className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
                      {event.image ? (
                        <img src={event.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)]">
                          <Search size={14} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{event.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-4 text-sm text-[var(--text-tertiary)]">
                {t.market.common.noData}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 已选事件提示 */}
      {/* {selectedEvent && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-500">
              {t.market.create.eventFound}
            </p>
            <p className="text-xs text-green-400 mt-0.5 truncate">
              {selectedEvent.title}
            </p>
          </div>
        </div>
      )} */}

      {/* Next button */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => {
            resetForm();
          }}
          className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline text-sm"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={handleEventInfoNext}
          disabled={!batchEventTitle.trim() || isCheckingEvent}
          className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isCheckingEvent ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.market.common.generating}
            </>
          ) : selectedEvent ? (
            t.market.common.next
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t.market.common.generate}
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Step 2: 事件详情 + Settings + 市场添加/生成/审核（合并原第2、3步）
  const renderBatchMarketsStep = () => {
    const hasGeneratedMarkets = batchMarkets.length > 0;
    const hasValidKeywords = marketKeywords.filter(k => k.trim()).length > 0;

    return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide px-0.5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setBatchCurrentStep(0);
            setReviewError(null);
            setReviewResult(null);
            setSubmitError(null);
            setBatchMarkets([]);
            setMarketKeywords([""]);
            setShowAddMoreInput(false);
            if (!isEventSelected) {
              setBatchEventDescription("");
              setBatchResolutionDate("");
              setBatchTags([]);
              setTagSearchQuery("");
            }
            setStep("event_info");
          }}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.batchGenerateMarkets}
        </h3>
      </div>

      {/* ===== 事件信息摘要 ===== */}
      <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] overflow-hidden">
        {/* 事件标题行 */}
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold flex-shrink-0">
            {isEventSelected ? t.market.create.existingEvent : t.market.create.newEvent}
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate flex-1">
            {batchEventTitle}
          </span>
        </div>

        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)] pt-3">
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1">
              {t.market.create.eventDescription}
            </label>
            <textarea
              value={batchEventDescription}
              onChange={(e) => setBatchEventDescription(e.target.value)}
              rows={4}
              disabled={isEventSelected}
              className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none ${isEventSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          {/* Resolution Date */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1">
              {t.market.create.commonResolutionDate} <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={batchResolutionDate ? dayjs(batchResolutionDate) : null}
              onChange={(date) => setBatchResolutionDate(date ? date.format('YYYY-MM-DD') : '')}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              disabled={isEventSelected}
              className="w-full"
              placeholder={t.market.create.commonResolutionDate}
              style={{ borderRadius: '0.5rem', padding: '0.375rem 0.75rem' }}
            />
          </div>

          {/* Tags - antd Select 多选 */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-2">
              {t.market.create.tagsLabel}
            </label>
            {!isEventSelected ? (
              <MultiCombobox
                allowClear
                placeholder={t.market.create.tagsPlaceholder}
                value={batchTags.map(tag => tag.slug)}
                onChange={(values) => {
                  const newTags = values.map(slug => {
                    const existing = batchTags.find(t => t.slug === slug);
                    if (existing) return existing;
                    const fromList = marketTagsList.find(t => t.slug === slug);
                    if (fromList) return { name: fromList.label, slug: fromList.slug };
                    return { name: slug, slug };
                  });
                  setBatchTags(newTags);
                }}
                onSearch={handleTagSearch}
                loading={isSearchingTags}
                options={marketTagsList.map(tag => ({ label: tag.label, value: tag.slug }))}
                emptyText={isSearchingTags ? t.market.create.searching : t.market.create.noTagsFound}
              />
            ) : (
              batchTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {batchTags.map((tag) => (
                    <span key={tag.slug} className="px-2.5 py-1 rounded-full bg-[var(--accent)] text-black text-xs font-semibold">
                      {tag.name}
                    </span>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ===== 已存在的市场（选择已有事件 或 审核记录中的已有市场，默认折叠） ===== */}
      {(() => {
        const eventMarkets = selectedEvent?.markets || [];
        const reviewExistingMarkets = initialData?.existingEventMarkets || [];
        const allExistingMarkets = eventMarkets.length > 0 ? eventMarkets : reviewExistingMarkets;
        if (allExistingMarkets.length === 0) return null;
        return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
          <button
            type="button"
            onClick={() => setExistingMarketsCollapsed((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {t.market.create.sportsConfigurator.existingMarkets}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[10px] text-[var(--text-secondary)] font-medium">
                {allExistingMarkets.length}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${
                existingMarketsCollapsed ? "" : "rotate-180"
              }`}
            />
          </button>
          {!existingMarketsCollapsed && (
            <div className="px-4 pb-3 space-y-2 border-t border-[var(--border)] pt-3">
              {allExistingMarkets.map((market: any, idx: number) => (
                <div
                  key={market.id ?? idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] opacity-70"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {market.question || market.title}
                    </p>
                    {(market.groupItemTitle || market.description) && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                        {market.groupItemTitle || market.description}
                      </p>
                    )}
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[10px] text-[var(--text-secondary)] shrink-0">
                    {t.market.create.sportsConfigurator.existingTag}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })()}

      {/* ===== 生成前：关键词输入 + 添加按钮 + 生成按钮 ===== */}
      {!hasGeneratedMarkets && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              {t.market.create.marketKeywordsLabel}
            </label>
            <div className="space-y-2">
              {marketKeywords.map((kw, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={kw}
                    onChange={(e) => handleUpdateKeyword(idx, e.target.value)}
                    placeholder={`${t.market.create.keywordPlaceholder} ${idx + 1}`}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                    onKeyDown={(e) => { if (e.key === 'Enter' && hasValidKeywords) handleGenerateMarkets(); }}
                  />
                  {marketKeywords.length > 1 && (
                    <button
                      onClick={() => handleRemoveKeyword(idx)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {/* 添加关键词按钮 - 底部虚线样式 */}
              <button
                type="button"
                onClick={handleAddKeywordInput}
                className="w-full py-2 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-1.5 text-sm"
              >
                <Plus className="w-4 h-4" />
                {t.market.create.addAnotherMarket}
              </button>
            </div>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerateMarkets}
            disabled={isGeneratingBatch || !hasValidKeywords}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGeneratingBatch ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.market.create.generatingMarkets}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t.market.create.generateMarkets}
              </>
            )}
          </button>
        </>
      )}

      {/* ===== 生成后：市场列表 + 添加更多 + 审核按钮 ===== */}
      {hasGeneratedMarkets && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-[var(--text-secondary)]">
                {t.market.create.generatedMarkets}
                <span className="text-[var(--accent)] ml-1.5">({batchMarkets.length})</span>
              </h4>
              <button
                onClick={() => { setBatchMarkets([]); setMarketKeywords([""]); }}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
              >
                {t.market.common.reset}
              </button>
            </div>

            {/* 已生成市场卡片（可编辑） */}
            <div className="space-y-2">
              {batchMarkets.map((market, mIdx) => (
                <div
                  key={market.id}
                  className={`p-3 rounded-xl border group transition-colors ${
                    market.error
                      ? 'bg-red-500/5'
                      : 'bg-[var(--bg-secondary)] border-[var(--border)]'
                  }`}
                  style={market.error ? {
                    borderColor: '#ef4444',
                    boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.3), 0 0 8px rgba(239, 68, 68, 0.15)',
                  } : undefined}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-md flex-shrink-0">
                          {market.keyword || "—"}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={market.question}
                        onChange={(e) => {
                          setBatchMarkets(prev => prev.map((m, i) =>
                            i === mIdx ? { ...m, question: e.target.value } : m
                          ));
                        }}
                        className="w-full text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                      <textarea
                        value={market.description || ""}
                        onChange={(e) => {
                          setBatchMarkets(prev => prev.map((m, i) =>
                            i === mIdx ? { ...m, description: e.target.value } : m
                          ));
                        }}
                        rows={2}
                        placeholder={t.market.create.eventDescription}
                        className="w-full text-xs text-[var(--text-secondary)] bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)] resize-none transition-colors"
                      />
                      {market.error && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          <span className="text-xs text-red-500">{market.error}</span>
                          {market.repeat_id != null && market.repeat_id > 0 && (
                            <span className="text-xs text-red-400 ml-1">(ID: {market.repeat_id})</span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveBatchMarket(market.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* 多条新增市场入口 */}
              {showAddMoreInput && (
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    {t.market.create.marketKeywordsLabel}
                  </label>
                  {marketKeywords.map((kw, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={kw}
                        onChange={(e) => handleUpdateKeyword(idx, e.target.value)}
                        placeholder={`${t.market.create.keywordPlaceholder} ${idx + 1}`}
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                        onKeyDown={(e) => { if (e.key === 'Enter' && hasValidKeywords) handleGenerateMarkets(); }}
                        autoFocus={idx === 0}
                      />
                      <button
                        onClick={() => {
                          if (marketKeywords.length <= 1) {
                            setShowAddMoreInput(false);
                            setMarketKeywords([""]);
                          } else {
                            handleRemoveKeyword(idx);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddKeywordInput}
                    className="w-full py-1.5 rounded-lg border border-dashed border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t.market.create.addAnotherMarket}
                  </button>
                  <button
                    onClick={handleGenerateMarkets}
                    disabled={isGeneratingBatch || !hasValidKeywords}
                    className="w-full py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isGeneratingBatch ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.market.create.generatingMarkets}</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" />{t.market.create.generateMarkets}</>
                    )}
                  </button>
                </div>
              )}

              {/* 添加更多市场按钮（始终可见） */}
              {!showAddMoreInput && (
                <button
                  type="button"
                  onClick={() => setShowAddMoreInput(true)}
                  className="w-full py-2 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-1.5 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  {t.market.create.addAnotherMarket}
                </button>
              )}
            </div>
          </div>

          {/* 审核/创建按钮 */}
          {!showAddMoreInput && (
            <>
              {reviewRecordMode && isReviewFormDirty && (
                <p className="text-xs text-amber-500 text-center">
                  {t.market.create.reviewFormChanged}
                </p>
              )}
              <button
                onClick={handleReviewEvent}
                disabled={isReviewingEvent || batchMarkets.length === 0}
                className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isReviewingEvent ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.market.create.reviewing}
                  </>
                ) : reviewRecordMode?.status === 'approved' && !isReviewFormDirty ? (
                  <>
                    <Check className="w-4 h-4" />
                    {t.market.create.reviewDirectCreate}
                  </>
                ) : reviewRecordMode ? (
                  <>
                    <Check className="w-4 h-4" />
                    {t.market.create.reviewResubmit}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {t.market.create.reviewSubmitAndCreate}
                  </>
                )}
              </button>
            </>
          )}
        </>
      )}

      {/* ===== 审核错误 ===== */}
      {reviewError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-red-500/10">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-500">{t.market.create.reviewFailed}</p>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {/* 事件级错误 */}
            {reviewResult?.event_result?.event_error && (
              <p className="text-xs text-red-400 break-words">
                {reviewResult.event_result.event_error}
              </p>
            )}
            {reviewResult?.event_result && !reviewResult.event_result.success && reviewResult.event_result.repeat_event_id != null && reviewResult.event_result.repeat_event_id > 0 && (
              <p className="text-xs text-red-400">
                {t.market.create.eventIdLabel}: {reviewResult.event_result.repeat_event_id}
              </p>
            )}
            {/* 逐条市场错误 */}
            {reviewResult?.market_result?.markets?.filter(item => !!item.market_error).map((item, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-red-400">
                <span className="text-red-500 flex-shrink-0 mt-px">•</span>
                <div className="min-w-0">
                  <span className="font-medium text-red-500">{item.title}</span>
                  <span className="mx-1">—</span>
                  <span>{item.market_error}</span>
                  {item.repeat_id != null && item.repeat_id > 0 && (
                    <span className="ml-1 text-red-500/70">(ID: {item.repeat_id})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-500">{t.market.create.createFailed}</p>
            <p className="text-xs text-red-400 mt-1 break-words">{submitError}</p>
          </div>
        </div>
      )}

    </div>
    );
  };

  // Step 3: Global Settings
  const renderGlobalSettingsStep = () => (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => {
            setBatchCurrentStep(1);
            setStep("batch_markets");
          }}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.globalSettings}
        </h3>
      </div>

      {/* Resolution Date */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.create.commonResolutionDate}{" "}
          <span className="text-red-500">*</span>
        </label>
        <DatePicker
            value={batchResolutionDate ? dayjs(batchResolutionDate) : null}
            onChange={(date) => setBatchResolutionDate(date ? date.format('YYYY-MM-DD') : '')}
            disabledDate={(current) => current && current < dayjs().startOf('day')}
            className="w-full"
            placeholder={t.market.create.commonResolutionDate}
            style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem' }}
          />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.create.tagsLabel}
        </label>

        {/* Selected tags */}
        {batchTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {batchTags.map((tag) => (
              <span
                key={tag.slug}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-medium"
              >
                {tag.name}
                <button
                  onClick={() => handleRemoveTag(tag.slug)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tag search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={tagSearchQuery}
            onChange={(e) => setTagSearchQuery(e.target.value)}
            placeholder={t.market.create.tagsPlaceholder}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagSearchQuery.trim()) {
                e.preventDefault();
                handleCreateTag(tagSearchQuery.trim());
              }
            }}
          />
        </div>

        {/* Available tags dropdown */}
        {(tagSearchQuery.trim() || availableTags.length > 0) && (
          <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
            {isLoadingTags ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />
              </div>
            ) : (
              <>
                {filteredTags.map((tag) => (
                  <button
                    key={tag.slug}
                    onClick={() =>
                      handleAddTag({ name: tag.name, slug: tag.slug })
                    }
                    disabled={batchTags.some((t) => t.slug === tag.slug)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Tag className="w-3 h-3 text-[var(--text-tertiary)]" />
                    <span className="text-[var(--text-primary)]">
                      {tag.name}
                    </span>
                  </button>
                ))}
                {tagSearchQuery.trim() &&
                  !filteredTags.some(
                    (t) =>
                      t.name.toLowerCase() ===
                      tagSearchQuery.trim().toLowerCase()
                  ) && (
                    <button
                      onClick={() => handleCreateTag(tagSearchQuery.trim())}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)] text-[var(--accent)] flex items-center gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      {t.market.create.newTagSuggestion(tagSearchQuery.trim())}
                    </button>
                  )}
                {filteredTags.length === 0 && !tagSearchQuery.trim() && (
                  <div className="px-3 py-2 text-sm text-[var(--text-tertiary)]">
                    {t.market.create.noTagsFound}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => {
            setBatchCurrentStep(1);
            setStep("batch_markets");
          }}
          className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline text-sm"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={() => {
            if (!batchResolutionDate) {
              toast.error(t.market.create.pleaseSelectResolutionDate);
              return;
            }
            setBatchCurrentStep(3);
            setStep("event_confirm");
          }}
          disabled={!batchResolutionDate}
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.market.common.next}
        </button>
      </div>
    </div>
  );

  // Step 4: Confirm & Submit
  const renderEventConfirmStep = () => (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide">

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => {
            setBatchCurrentStep(2);
            setStep("global_settings");
          }}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          {t.market.create.reviewEventAndMarkets}
        </h3>
      </div>

      {/* Event summary card */}
      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3">
        <div>
          <span className="text-xs text-[var(--text-tertiary)]">
            {t.market.create.eventTitle}
          </span>
          <p className="font-semibold text-[var(--text-primary)]">
            {batchEventTitle}
          </p>
        </div>

        {batchEventDescription && (
          <div>
            <span className="text-xs text-[var(--text-tertiary)]">
              {t.market.create.eventDescription}
            </span>
            <p className="text-sm text-[var(--text-primary)]">
              {batchEventDescription}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <div>
            <span className="text-xs text-[var(--text-tertiary)]">
              {t.market.create.commonResolutionDate}
            </span>
            <p className="text-sm font-medium text-[var(--accent)]">
              {batchResolutionDate}
            </p>
          </div>

          {batchEventId && (
            <div>
              <span className="text-xs text-[var(--text-tertiary)]">
                {t.market.create.eventIdLabel}
              </span>
              <p className="text-sm font-medium text-green-500">
                {batchEventId} ({t.market.create.existingEvent})
              </p>
            </div>
          )}
        </div>

        {batchTags.length > 0 && (
          <div>
            <span className="text-xs text-[var(--text-tertiary)]">
              {t.market.create.tagsLabel}
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {batchTags.map((tag) => (
                <span
                  key={tag.slug}
                  className="px-2 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Markets list */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
          {t.market.create.totalMarkets(batchMarkets.length)}
        </h4>
        <div className="space-y-2">
          {batchMarkets.map((market, idx) => (
            <div
              key={market.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[var(--accent)]">
                  {idx + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {t.market.create.marketItemPrefix}: {market.question}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-500">
              {t.market.create.createFailed}
            </p>
            <p className="text-xs text-red-400 mt-1 break-words">
              {submitError}
            </p>
          </div>
        </div>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => {
            setBatchCurrentStep(2);
            setStep("global_settings");
          }}
          className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline text-sm"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={handleSubmitBatchMarkets}
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.market.create.submittingEvent}
            </>
          ) : (
            t.market.create.submitEventAndMarkets
          )}
        </button>
      </div>
    </div>
  );

  // 渲染当前步骤
  const renderCurrentStep = () => {
    switch (step) {
      case "category":
        return renderCategoryStep();
      case "candidate":
        return renderCandidateStep();
      case "config":
        return renderConfigStep();
      case "confirm":
        return renderConfirmStep();
      case "processing":
        return renderProcessingStep();
      case "success":
        return renderSuccessStep();
      // General market flow
      case "general_question":
        return renderGeneralQuestionStep();
      case "general_details":
        return renderGeneralDetailsStep();
      case "general_preview":
        return renderGeneralPreviewStep();
      // Crypto flow
      case "crypto_select_event":
        return renderCryptoSelectEventStep();
      case "crypto_form":
        return renderCryptoFormStep();
      // Batch Event & Markets flow (2-step: event_info → batch_markets)
      case "event_info":
        return renderEventInfoStep();
      case "batch_markets":
      case "global_settings":  // 已合并到 batch_markets
      case "event_confirm":    // 已合并到 batch_markets
        return renderBatchMarketsStep();
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      title={
        step === "success" || step === "processing"
          ? undefined
          : t.market.create.title
      }
      onOpenChange={handleClose}
      size="xl"
      showClose={step !== "processing"}
      className="!max-w-4xl max-md:!max-w-full max-md:!m-2"
    >
      <div className="p-4">{renderCurrentStep()}</div>
    </Dialog>
  );
}
