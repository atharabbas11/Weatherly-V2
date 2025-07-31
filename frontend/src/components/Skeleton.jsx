export const Skeleton = ({ type = "text", className = "" }) => {
  const baseClasses = "animate-pulse bg-gray-200 dark:bg-gray-700 rounded";
  
  if (type === "text") {
    return <div className={`${baseClasses} h-4 w-full ${className}`}></div>;
  }
  
  if (type === "circle") {
    return <div className={`${baseClasses} rounded-full ${className}`}></div>;
  }
  
  if (type === "image") {
    return <div className={`${baseClasses} aspect-square ${className}`}></div>;
  }
  
  return <div className={baseClasses}></div>;
};

export const WeatherCardSkeleton = () => (
  <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-2xl border border-blue-200 dark:border-gray-700 rounded-2xl p-6 space-y-6 text-center max-w-3xl mx-auto">
    {/* Location skeleton skeleton */}
    <div className="space-y-2">
      <Skeleton type="text" className="h-8 w-3/4 mx-auto" />
      <Skeleton type="text" className="h-4 w-1/2 mx-auto" />
    </div>
    
    {/* Weather icon and temp skeleton */}
    <div className="flex flex-col items-center mt-4 space-y-4">
      <Skeleton type="circle" className="h-28 w-28" />
      <Skeleton type="text" className="h-12 w-1/4" />
      <Skeleton type="text" className="h-6 w-1/2" />
      <Skeleton type="text" className="h-4 w-1/3" />
    </div>
    
    {/* Stats grid skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
          <Skeleton type="circle" className="h-6 w-6" /> {/* Icon skeleton */}
          <div className="flex flex-col space-y-2">
          <Skeleton type="text" className="h-4 w-24 sm:w-28 lg:w-32" />
          <Skeleton type="text" className="h-4 w-32 sm:w-40 lg:w-56" />
          </div>
        </div>
      ))}
    </div>

    {/* Hourly Forscast skeleton */}
    <Skeleton type="text" className="h-6 w-1/2 mb-4" />

    {/* Horizontal scrollable skeleton row */}
    <div className="overflow-x-auto forecast-scroll">
      <div className="flex space-x-4 pb-2">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center p-3 rounded-lg min-w-[80px] bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
          >
            <Skeleton type="text" className="h-4 w-12 mb-2" /> {/* Time */}
            <Skeleton type="circle" className="h-10 w-10 mb-2" /> {/* Icon */}
            <Skeleton type="text" className="h-4 w-8 mb-2" /> {/* Temp */}
            <Skeleton type="text" className="h-3 w-12 mb-1" /> {/* Rain */}
            <Skeleton type="text" className="h-3 w-10" /> {/* Wind */}
          </div>
        ))}
      </div>
    </div>

    <Skeleton type="text" className="h-7 w-1/4 mx-auto" />
    <Skeleton type="text" className="h-7 w-1/4 mx-auto" />

    {/* Forecast skeleton */}
    <div className="mt-8 space-y-4">
      <Skeleton type="text" className="h-6 w-1/4 mx-auto" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white/90 dark:bg-gray-700/90 border border-blue-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
            <Skeleton type="text" className="h-5 w-full" />
            <Skeleton type="circle" className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 mx-auto"/>

            <Skeleton type="text" className="h-4 w-3/4 mx-auto" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton type="text" className="h-5 w-full" />
                  <Skeleton type="text" className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const MapSkeleton = () => (
  <div className="rounded-lg overflow-hidden shadow-lg border border-blue-300 dark:border-gray-700">
    <div className="h-[300px] w-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
  </div>
);

export const SavedSkeleton = () => (
  <div className="rounded-lg overflow-hidden shadow-lg border border-blue-300 dark:border-gray-700">
    <div className="h-[300px] w-full bg-gray-200 dark:bg-gray-700 animate-pulse">
    </div>
  </div>
);