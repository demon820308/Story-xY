/**
 * 设定文件分类与分类体系解析器（M34 单一事实源）
 * 对齐 skill 设定 taxonomy：题材 / 角色 / 世界观 / 势力 / 体系 / 其他
 */

export type SettingCategory = "all" | "theme" | "character" | "world" | "faction" | "system" | "other";

export interface SettingCategoryMeta {
  key: SettingCategory;
  label: string;
  iconName: string;
}

export const SETTING_CATEGORIES: SettingCategoryMeta[] = [
  { key: "all", label: "全部", iconName: "all" },
  { key: "theme", label: "题材", iconName: "theme" },
  { key: "character", label: "角色", iconName: "character" },
  { key: "world", label: "世界观", iconName: "world" },
  { key: "faction", label: "势力", iconName: "faction" },
  { key: "system", label: "体系", iconName: "system" },
];

/**
 * 根据文件名与相对路径智能判定分类
 * 规则：
 * 1. 根目录或任意目录中包含「题材」、「定位」、「文风」的文件归为 theme（不再误入 system）
 * 2. 包含「角色」、「人设」、「人物」或在「角色/」目录下的文件归为 character
 * 3. 包含「世界观」、「地理」、「历史」、「地图」或在「世界观/」目录下的文件归为 world
 * 4. 包含「势力」、「门派」、「宗门」、「组织」、「阵营」或在「势力/」目录下的文件归为 faction
 * 5. 包含「体系」、「金手指」、「等级」、「升级」、「功法」、「能力」或在「体系/」目录下的文件归为 system
 * 6. 其余未匹配项归为 other（或在根目录归入 theme / system 适当位置）
 */
export function classifySettingFile(fileName: string, relPath: string = ""): Exclude<SettingCategory, "all"> {
  const normPath = relPath.replace(/\\/g, "/").toLowerCase();
  const baseName = fileName.replace(/\.(md|txt)$/i, "").toLowerCase();

  // 1. 题材优先（彻底解决根目录 题材定位.md 误分类为体系的问题）
  if (
    baseName.includes("题材") ||
    baseName.includes("定位") ||
    baseName.includes("文风") ||
    baseName.includes("类型") ||
    normPath.includes("/题材/") ||
    normPath.startsWith("题材/")
  ) {
    return "theme";
  }

  // 2. 角色
  if (
    normPath.includes("/角色/") ||
    normPath.startsWith("角色/") ||
    baseName.includes("角色") ||
    baseName.includes("人设") ||
    baseName.includes("人物")
  ) {
    return "character";
  }

  // 3. 世界观
  if (
    normPath.includes("/世界观/") ||
    normPath.startsWith("世界观/") ||
    baseName.includes("世界观") ||
    baseName.includes("地理") ||
    baseName.includes("历史") ||
    baseName.includes("地图") ||
    baseName.includes("编年史")
  ) {
    return "world";
  }

  // 4. 势力
  if (
    normPath.includes("/势力/") ||
    normPath.startsWith("势力/") ||
    baseName.includes("势力") ||
    baseName.includes("门派") ||
    baseName.includes("宗门") ||
    baseName.includes("组织") ||
    baseName.includes("阵营")
  ) {
    return "faction";
  }

  // 5. 体系
  if (
    normPath.includes("/体系/") ||
    normPath.startsWith("体系/") ||
    baseName.includes("体系") ||
    baseName.includes("金手指") ||
    baseName.includes("升级") ||
    baseName.includes("等级") ||
    baseName.includes("功法") ||
    baseName.includes("能力") ||
    baseName.includes("规则")
  ) {
    return "system";
  }

  // 6. 其他根文件默认视作题材或体系
  if (baseName.includes("大纲") || baseName.includes("梗")) {
    return "theme";
  }

  return "system";
}
