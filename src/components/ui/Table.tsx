import React from 'react';
import { clsx } from 'clsx';
import './Table.css';

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className="table-container">
      <table className={clsx('table', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={clsx('table-header', className)} {...props}>{children}</thead>;
}

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={clsx('table-body', className)} {...props}>{children}</tbody>;
}

export function TableRow({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={clsx('table-row', className)} {...props}>{children}</tr>;
}

export function TableHead({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={clsx('table-head', className)} {...props}>{children}</th>;
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx('table-cell', className)} {...props}>{children}</td>;
}
