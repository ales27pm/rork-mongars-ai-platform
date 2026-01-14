cmake_minimum_required(VERSION 3.18)
project(native_llm_jni)

set(CMAKE_CXX_STANDARD 17)

add_subdirectory(third_party/llama.cpp)

add_library(native_llm_jni SHARED
    native_llm_jni.cpp
)

find_library(log-lib log)
find_library(android-lib android)

include_directories(
    third_party/llama.cpp
)

target_link_libraries(native_llm_jni
    llama
    ${log-lib}
    ${android-lib}
)
