import React from "react";
import classNames from "classnames/bind";
import map from "lodash/map";
import isUndefined from "lodash/isUndefined";
import times from "lodash/times";
import Spin from "antd/lib/spin";
import Icon from "antd/lib/icon";
import { Spinner } from "@cockroachlabs/icons";
import { Empty, EmptyProps } from "../empty";
import styles from "./sortabletable.module.scss";

const cx = classNames.bind(styles);

/**
 * SortableColumn describes the contents a single column of a
 * sortable table.
 */
export interface SortableColumn {
  // Text that will appear in the title header of the table.
  title: React.ReactNode;
  // Function which provides the contents for this column for a given row index
  // in the dataset.
  cell: (rowIndex: number) => React.ReactNode;
  // Contents that will appear in the "rollup" header of this column.
  rollup?: React.ReactNode;
  // Unique key that identifies this column from others, for the purpose of
  // indicating sort order. If not provided, the column is not considered
  // sortable.
  sortKey?: any;
  // className is a classname to apply to the td elements
  className?: string;
  titleAlign?: "left" | "right" | "center";
}

/**
 * SortSetting is the structure that SortableTable uses to indicate its current
 * sort preference to higher-level components. It contains a sortKey (taken from
 * one of the currently displayed columns) and a boolean indicating that the
 * sort should be ascending, rather than descending.
 */
export interface SortSetting {
  sortKey: any;
  ascending: boolean;
}

/**
 * TableProps are the props that should be passed to SortableTable.
 */
interface TableProps {
  // Number of rows in the table.
  count: number;
  // Array of SortableColumns to render.
  columns: SortableColumn[];
  // Current sortSetting that was used to sort incoming data.
  sortSetting?: SortSetting;
  // Callback that should be invoked when the user want to change the sort
  // setting.
  onChangeSortSetting?: { (ss: SortSetting): void };
  // className to be applied to the table element.
  className?: string;
  // A function that returns the class to apply to a given row.
  rowClass?: (rowIndex: number) => string;
  // expandableConfig, if provided, makes each row in the table "expandable",
  // i.e. each row has an expand/collapse arrow on its left, and renders
  // a full-width area below it when expanded.
  expandableConfig?: ExpandableConfig;
  firstCellBordered?: boolean;
  renderNoResult?: React.ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  // empty state for table
  empty?: boolean;
  emptyProps?: EmptyProps;
}

export interface ExpandableConfig {
  // Called when the expand toggle is clicked. If this prop is not supplied,
  // the table is not expandable and the expansion control is not shown.
  onChangeExpansion: (rowIndex: number, expanded: boolean) => void;
  // Given a row index, return whether that row is expanded.
  rowIsExpanded: (rowIndex: number) => boolean;
  // If a row is expanded, this function is called to get the content for the
  // full-width expanded section.
  expandedContent: (rowIndex: number) => React.ReactNode;
}

/**
 * SortableTable is designed to display tabular data where the data set can be
 * sorted by one or more columns.
 *
 * SortableTable is not responsible for sorting data; however, it does allow the
 * user to indicate how data should be sorted by clicking on column headers.
 * SortableTable can indicate this to higher-level components through the
 * 'onChangeSortSetting' callback property.
 */
export class SortableTable extends React.Component<TableProps> {
  static defaultProps: TableProps = {
    count: 0,
    columns: [],
    sortSetting: {
      sortKey: null,
      ascending: false,
    },
    onChangeSortSetting: _ss => {},
    rowClass: _rowIndex => "",
  };

  state = {
    visible: false,
    activeIndex: NaN,
  };

  clickSort(clickedSortKey: any) {
    const { sortSetting, onChangeSortSetting } = this.props;

    // If the sort key is different than the previous key, initial sort
    // descending. If the same sort key is clicked multiple times consecutively,
    // first change to ascending, then remove the sort key.
    let ascending = false;
    if (sortSetting.sortKey === clickedSortKey) {
      if (!sortSetting.ascending) {
        ascending = true;
      } else {
        clickedSortKey = null;
      }
    }

    onChangeSortSetting({
      sortKey: clickedSortKey,
      ascending,
    });
  }

  expansionControl(expanded: boolean) {
    const content = expanded ? "▼" : "▶";
    return (
      <td
        className={cx(
          "sort-table__cell",
          "sort-table__cell__expansion-control",
        )}
      >
        <div>{content}</div>
      </td>
    );
  }

  renderRow = (rowIndex: number) => {
    const { columns, expandableConfig, firstCellBordered } = this.props;
    const classes = cx(
      "sort-table__row",
      "sort-table__row--body",
      this.state.activeIndex === rowIndex ? "drawer-active" : "",
      this.props.rowClass(rowIndex),
      { "sort-table__row--expandable": !!expandableConfig },
    );
    const expanded =
      expandableConfig && expandableConfig.rowIsExpanded(rowIndex);
    const onClickExpand =
      expandableConfig && expandableConfig.onChangeExpansion;
    const output = [
      <tr
        key={rowIndex}
        className={classes}
        onClick={() => {
          if (onClickExpand) {
            onClickExpand(rowIndex, !expanded);
          }
        }}
      >
        {expandableConfig ? this.expansionControl(expanded) : null}
        {map(columns, (c: SortableColumn, colIndex: number) => {
          return (
            <td
              className={cx(
                "sort-table__cell",
                {
                  "sort-table__cell--header":
                    firstCellBordered && colIndex === 0,
                },
                c.className,
              )}
              key={colIndex}
            >
              {c.cell(rowIndex)}
            </td>
          );
        })}
      </tr>,
    ];
    if (expandableConfig && expandableConfig.rowIsExpanded(rowIndex)) {
      const expandedAreaClasses = cx(
        "sort-table__row",
        "sort-table__row--body",
        "sort-table__row--expanded-area",
      );
      output.push(
        // Add a zero-height empty row so that the expanded area will have the same background
        // color as the row it's expanded from, since the CSS causes row colors to alternate.
        <tr className={classes} key={output.length + 1} />,
        <tr className={expandedAreaClasses} key={output.length + 2}>
          <td />
          <td className={cx("sort-table__cell")} colSpan={columns.length}>
            {expandableConfig.expandedContent(rowIndex)}
          </td>
        </tr>,
      );
    }
    return output;
  };

  render() {
    const {
      sortSetting,
      columns,
      expandableConfig,
      firstCellBordered,
      count,
      renderNoResult,
      className,
      loading,
      loadingLabel,
      empty,
      emptyProps,
    } = this.props;
    if (empty) {
      return <Empty {...emptyProps} />;
    }
    return (
      <div className={cx("cl-table-wrapper")}>
        <table className={cx("sort-table", className)}>
          <thead>
            <tr className={cx("sort-table__row", "sort-table__row--header")}>
              {expandableConfig ? (
                <th className={cx("sort-table__cell")} />
              ) : null}
              {map(columns, (c: SortableColumn, colIndex: number) => {
                const classes = [cx("sort-table__cell")];
                const style = {
                  textAlign: c.titleAlign,
                };
                let onClick: (e: any) => void = undefined;

                if (!isUndefined(c.sortKey)) {
                  classes.push(cx("sort-table__cell--sortable"));
                  onClick = () => {
                    this.clickSort(c.sortKey);
                  };
                  if (c.sortKey === sortSetting.sortKey) {
                    if (sortSetting.ascending) {
                      classes.push(cx("sort-table__cell--ascending"));
                    } else {
                      classes.push(cx("sort-table__cell--descending"));
                    }
                  }
                }
                if (firstCellBordered && colIndex === 0) {
                  classes.push(cx("sort-table__cell--header"));
                }
                return (
                  <th
                    className={classNames(classes)}
                    key={colIndex}
                    onClick={onClick}
                    style={style}
                  >
                    {c.title}
                    {!isUndefined(c.sortKey) && (
                      <span className={cx("sortable__actions")} />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{!loading && times(this.props.count, this.renderRow)}</tbody>
        </table>
        {loading && (
          <div className={cx("table__loading")}>
            <Spin
              className={cx("table__loading--spin")}
              indicator={<Icon component={Spinner} spin />}
            />
            {loadingLabel && (
              <span className={cx("table__loading--label")}>
                {loadingLabel}
              </span>
            )}
          </div>
        )}
        {count === 0 && (
          <div className={cx("table__no-results")}>{renderNoResult}</div>
        )}
      </div>
    );
  }
}
