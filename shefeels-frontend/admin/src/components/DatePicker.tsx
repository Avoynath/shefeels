import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import 'react-day-picker/dist/style.css';

interface DatePickerProps {
    value?: string; // ISO date string (yyyy-mm-dd)
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
    minDate?: Date;
    maxDate?: Date;
}

export function DatePicker({
    value,
    onChange,
    placeholder = 'Select date',
    className = '',
    minDate,
    maxDate
}: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
        value ? new Date(value) : undefined
    );
    const containerRef = useRef<HTMLDivElement>(null);

    // Update selected date when value prop changes
    useEffect(() => {
        if (value) {
            setSelectedDate(new Date(value));
        } else {
            setSelectedDate(undefined);
        }
    }, [value]);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (date: Date | undefined) => {
        if (date) {
            setSelectedDate(date);
            // Format as yyyy-mm-dd for consistency
            const formatted = format(date, 'yyyy-MM-dd');
            onChange(formatted);
            setIsOpen(false);
        }
    };

    const displayValue = selectedDate
        ? format(selectedDate, 'MMM dd, yyyy')
        : '';

    return (
        <div className="relative inline-block" ref={containerRef}>
            <div className="relative">
                <input
                    type="text"
                    value={displayValue}
                    onClick={() => setIsOpen(!isOpen)}
                    placeholder={placeholder}
                    readOnly
                    className={`px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
                />
                <svg
                    className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
            </div>

            {isOpen && (
                <div
                    className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
                    style={{ minWidth: '300px' }}
                >
                    <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleSelect}
                        disabled={[
                            ...(minDate ? [{ before: minDate }] : []),
                            ...(maxDate ? [{ after: maxDate }] : [])
                        ]}
                        className="rdp-custom"
                    />
                    {selectedDate && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setSelectedDate(undefined);
                                    onChange('');
                                    setIsOpen(false);
                                }}
                                className="flex-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex-1 px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
