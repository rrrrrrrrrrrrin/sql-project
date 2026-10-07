cmake_minimum_required(VERSION 3.20)

project(gamestore_backend)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Crow CONFIG REQUIRED)
find_package(libpqxx CONFIG REQUIRED)

add_executable(gamestore
    src/main.cpp
)

target_link_libraries(gamestore
    PRIVATE
        Crow::Crow
        libpqxx::pqxx
)