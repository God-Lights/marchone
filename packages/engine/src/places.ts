import type { LatLng } from "./types";

/**
 * Landmass id. Two places share a landmass only if they are connected by land
 * (or a land route such as the Channel Tunnel), so land modes can travel between them.
 */
export type Landmass =
  | "afro-eurasia"
  | "americas"
  | "australia"
  | "japan"
  | "taiwan"
  | "iceland"
  | "new-zealand"
  | "hawaii";

export interface Place extends LatLng {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  tz: string;
  landmass: Landmass;
}

const p = (
  id: string, name: string, nameEn: string, country: string,
  lat: number, lng: number, tz: string, landmass: Landmass = "afro-eurasia",
): Place => ({ id, name, nameEn, country, lat, lng, tz, landmass });

export const PLACES: readonly Place[] = [
  // 동아시아
  p("seoul", "서울", "Seoul", "대한민국", 37.5665, 126.978, "Asia/Seoul"),
  p("busan", "부산", "Busan", "대한민국", 35.1796, 129.0756, "Asia/Seoul"),
  p("tokyo", "도쿄", "Tokyo", "일본", 35.6762, 139.6503, "Asia/Tokyo", "japan"),
  p("osaka", "오사카", "Osaka", "일본", 34.6937, 135.5023, "Asia/Tokyo", "japan"),
  p("beijing", "베이징", "Beijing", "중국", 39.9042, 116.4074, "Asia/Shanghai"),
  p("shanghai", "상하이", "Shanghai", "중국", 31.2304, 121.4737, "Asia/Shanghai"),
  p("hong-kong", "홍콩", "Hong Kong", "중국", 22.3193, 114.1694, "Asia/Hong_Kong"),
  p("taipei", "타이베이", "Taipei", "대만", 25.033, 121.5654, "Asia/Taipei", "taiwan"),
  p("ulaanbaatar", "울란바토르", "Ulaanbaatar", "몽골", 47.8864, 106.9057, "Asia/Ulaanbaatar"),
  // 동남아·남아시아
  p("hanoi", "하노이", "Hanoi", "베트남", 21.0278, 105.8342, "Asia/Bangkok"),
  p("bangkok", "방콕", "Bangkok", "태국", 13.7563, 100.5018, "Asia/Bangkok"),
  p("singapore", "싱가포르", "Singapore", "싱가포르", 1.3521, 103.8198, "Asia/Singapore"),
  p("kathmandu", "카트만두", "Kathmandu", "네팔", 27.7172, 85.324, "Asia/Kathmandu"),
  p("delhi", "델리", "Delhi", "인도", 28.6139, 77.209, "Asia/Kolkata"),
  p("mumbai", "뭄바이", "Mumbai", "인도", 19.076, 72.8777, "Asia/Kolkata"),
  // 중앙아시아·중동
  p("almaty", "알마티", "Almaty", "카자흐스탄", 43.222, 76.8512, "Asia/Almaty"),
  p("samarkand", "사마르칸트", "Samarkand", "우즈베키스탄", 39.6542, 66.9597, "Asia/Samarkand"),
  p("tehran", "테헤란", "Tehran", "이란", 35.6892, 51.389, "Asia/Tehran"),
  p("dubai", "두바이", "Dubai", "아랍에미리트", 25.2048, 55.2708, "Asia/Dubai"),
  p("istanbul", "이스탄불", "Istanbul", "튀르키예", 41.0082, 28.9784, "Europe/Istanbul"),
  // 유럽
  p("moscow", "모스크바", "Moscow", "러시아", 55.7558, 37.6173, "Europe/Moscow"),
  p("athens", "아테네", "Athens", "그리스", 37.9838, 23.7275, "Europe/Athens"),
  p("rome", "로마", "Rome", "이탈리아", 41.9028, 12.4964, "Europe/Rome"),
  p("berlin", "베를린", "Berlin", "독일", 52.52, 13.405, "Europe/Berlin"),
  p("paris", "파리", "Paris", "프랑스", 48.8566, 2.3522, "Europe/Paris"),
  p("london", "런던", "London", "영국", 51.5074, -0.1278, "Europe/London"),
  p("madrid", "마드리드", "Madrid", "스페인", 40.4168, -3.7038, "Europe/Madrid"),
  p("santiago-de-compostela", "산티아고 데 콤포스텔라", "Santiago de Compostela", "스페인", 42.8782, -8.5448, "Europe/Madrid"),
  p("lisbon", "리스본", "Lisbon", "포르투갈", 38.7223, -9.1393, "Europe/Lisbon"),
  p("reykjavik", "레이캬비크", "Reykjavik", "아이슬란드", 64.1466, -21.9426, "Atlantic/Reykjavik", "iceland"),
  // 아프리카
  p("cairo", "카이로", "Cairo", "이집트", 30.0444, 31.2357, "Africa/Cairo"),
  p("marrakech", "마라케시", "Marrakech", "모로코", 31.6295, -7.9811, "Africa/Casablanca"),
  p("nairobi", "나이로비", "Nairobi", "케냐", -1.2921, 36.8219, "Africa/Nairobi"),
  p("cape-town", "케이프타운", "Cape Town", "남아프리카공화국", -33.9249, 18.4241, "Africa/Johannesburg"),
  // 아메리카
  p("vancouver", "밴쿠버", "Vancouver", "캐나다", 49.2827, -123.1207, "America/Vancouver", "americas"),
  p("los-angeles", "로스앤젤레스", "Los Angeles", "미국", 34.0522, -118.2437, "America/Los_Angeles", "americas"),
  p("new-york", "뉴욕", "New York", "미국", 40.7128, -74.006, "America/New_York", "americas"),
  p("mexico-city", "멕시코시티", "Mexico City", "멕시코", 19.4326, -99.1332, "America/Mexico_City", "americas"),
  p("cusco", "쿠스코", "Cusco", "페루", -13.532, -71.9675, "America/Lima", "americas"),
  p("buenos-aires", "부에노스아이레스", "Buenos Aires", "아르헨티나", -34.6037, -58.3816, "America/Argentina/Buenos_Aires", "americas"),
  p("rio-de-janeiro", "리우데자네이루", "Rio de Janeiro", "브라질", -22.9068, -43.1729, "America/Sao_Paulo", "americas"),
  // 오세아니아·태평양
  p("honolulu", "호놀룰루", "Honolulu", "미국", 21.3069, -157.8583, "Pacific/Honolulu", "hawaii"),
  p("sydney", "시드니", "Sydney", "호주", -33.8688, 151.2093, "Australia/Sydney", "australia"),
  p("auckland", "오클랜드", "Auckland", "뉴질랜드", -36.8485, 174.7633, "Pacific/Auckland", "new-zealand"),
];

const byId = new Map(PLACES.map((pl) => [pl.id, pl]));

export function placeById(id: string): Place | undefined {
  return byId.get(id);
}

/** Simple search over Korean/English name and country. */
export function searchPlaces(query: string, limit = 8): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLACES.slice(0, limit);
  return PLACES.filter(
    (pl) => pl.name.includes(q) || pl.nameEn.toLowerCase().includes(q) || pl.country.includes(q),
  ).slice(0, limit);
}
