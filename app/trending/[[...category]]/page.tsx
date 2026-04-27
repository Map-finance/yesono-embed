import { getTagTree, getEvents, getCryptoEvents } from "@/lib/services/homeService";
import { TagTreeNode } from "@/types/home";
import TrendingClient from "./TrendingClient";

// 虚拟分类：不是真实 tag slug
const VIRTUAL_CATEGORIES = ["trending", "new"];
export default async function TrendingPage({
    params,
    searchParams,
}: {
    params?: { category?: string[] | string };
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    // const categoryParam = params?.category || ([] as string[]);
    // const category = categoryParam[0] ?? "trending";
    // const isVirtualCategory = VIRTUAL_CATEGORIES.includes(category.toLowerCase());
    // const categoryArg = isVirtualCategory ? category.toLowerCase() : undefined;
    // const isCrypto = category.toLowerCase() === "crypto";

    // let initialTags: TagTreeNode[] = [];

    // try {
    //     initialTags = await getTagTree(category, true, categoryArg);
    // } catch (err) {
    //     initialTags = [];
    // }

    // const pageNum = parseInt((searchParams?.page as string) ?? "1", 10) || 1;
    // const limit = 20;
    // const offset = (pageNum - 1) * limit;

    // const baseQuery: Record<string, any> = {
    //     active: true,
    //     limit,
    //     offset,
    // };
    // const slugParam = (searchParams?.slug as string);
    // if (slugParam) {
    //     if (isCrypto) {
    //         baseQuery.apiType = "crypto";
    //         baseQuery.cryptoSlug = slugParam;
    //     } else {
    //         baseQuery.tag_slug = slugParam;
    //     }
    // }
    // if (!isVirtualCategory) {
    //     baseQuery.tag_slug = category.toLowerCase();
    // } else {
    //     const lower = category.toLowerCase();
    //     if (lower === "trending" && !baseQuery.order) baseQuery.order = "-volume";
    //     if (lower === "new" && !baseQuery.order) baseQuery.order = "+startdate";
    // }

    // let initialData: any = null;
    // try {
    //     if (category.toLowerCase() === "crypto") {
    //         const slug = (searchParams?.cryptoSlug as string) || "crypto";
    //         initialData = await getCryptoEvents({
    //             slug,
    //             limit,
    //             offset,
    //         });
    //     } else {
    //         initialData = await getEvents(baseQuery);
    //     }
    // } catch (err) {
    //     initialData = null;
    // }
    // const nextPage = pageNum + 1;
    // const nextHref = `/trending?page=${nextPage}`;

    return (
        <>
            <TrendingClient initialTags={/*initialTags*/undefined} initialData={/*initialData*/undefined} />
            {/* SEO优化：可被爬虫抓取的下一页链接（对视觉隐藏但不 display:none） */}
            {/* <a href={nextHref} className="sr-only">
                Next page
            </a> */}
        </>
    );
}
