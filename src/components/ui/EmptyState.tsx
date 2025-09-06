import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: EmptyStateProps) => {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      {Icon && (
        <Icon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 mb-4">{description}</p>
      )}
      {action && action}
    </div>
  );
};