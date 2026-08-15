import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { SvgIconComponent } from '@mui/icons-material';
import type { OrderDisplayIcon } from '../../lib/patients';

const ICONS: Record<OrderDisplayIcon, SvgIconComponent> = {
  ordered: ReceiptLongOutlinedIcon,
  vendor_accepted: FactCheckOutlinedIcon,
  in_transit: LocalShippingOutlinedIcon,
  late: WarningAmberRoundedIcon,
  delivered: CheckCircleOutlinedIcon,
  awaiting_pickup: AssignmentReturnOutlinedIcon,
  picked_up: KeyboardReturnOutlinedIcon,
};

export function OrderStatusIcon({ icon, className }: { icon: OrderDisplayIcon; className?: string }) {
  const Icon = ICONS[icon] ?? ICONS.ordered;

  // 'late' keeps the filled-badge treatment so it reads as an alert, not just another line icon.
  if (icon === 'late') {
    return (
      <span
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-[5px] bg-solid-bg ${className ?? ''}`}
      >
        <Icon className="text-solid-ink" sx={{ fontSize: 14 }} />
      </span>
    );
  }

  return (
    <Icon
      className={`flex-none ${icon === 'picked_up' ? 'text-ink-3' : 'text-ink'} ${className ?? ''}`}
      sx={{ fontSize: 20 }}
    />
  );
}
