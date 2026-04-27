export interface Response<T> {
  success: boolean,
  code: number,
  msg: string,
  data: T
}

export interface PageResponse<T, K extends string> extends Response<Record<K, T[]> & {
  pageSize: number;
  totalResults: number;
  offset: number;
  page: number;
}> {}
