import classNames from "classnames";
import { useTranslation } from "next-i18next";

import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Folder({ widget, id, name }) {
  const { t } = useTranslation();
  const { data, error } = useWidgetAPI(widget, "completion", { folder: id });

  const completion = Math.max(0, Math.min(100, Number(data?.completion) || 0));
  const totalBytes = Number(data?.globalBytes) || 0;
  const remainingBytes = Number(data?.needBytes) || 0;
  const syncedBytes = Math.max(0, totalBytes - remainingBytes);

  const statusColor = error
    ? "bg-red-500"
    : completion >= 100
      ? "bg-green-500"
      : "bg-yellow-500";

  const progressText = error
    ? "Error"
    : !data
      ? "Loading..."
      : `${t("common.bytes", {
          value: syncedBytes,
          maximumFractionDigits: 1,
          binary: true,
        })} / ${t("common.bytes", {
          value: totalBytes,
          maximumFractionDigits: 1,
          binary: true,
        })}`;

  return (
    <div className="flex flex-row items-center text-xs relative h-5 w-full rounded-md bg-theme-200/50 dark:bg-theme-900/20 mt-1 text-theme-700 dark:text-theme-200">
      <div
        className="absolute h-5 rounded-md bg-theme-200 dark:bg-theme-900/40 z-0"
        style={{ width: `${completion}%` }}
      />

      <span className="ml-2 h-2 w-2 z-10">
        <span className={classNames("block w-2 h-2 rounded-sm", statusColor)} />
      </span>

      <div className="text-xs z-10 self-center ml-2 relative h-4 grow mr-2 min-w-0">
        <div className="absolute w-full whitespace-nowrap text-ellipsis overflow-hidden text-left">
          {name}
        </div>
      </div>

      <div className="self-center text-xs flex justify-end mr-1.5 pl-1 z-10 text-ellipsis overflow-hidden whitespace-nowrap">
        <span>{progressText}</span>
        {!error && data && <span className="pl-2">({Math.round(completion)}%)</span>}
      </div>
    </div>
  );
}